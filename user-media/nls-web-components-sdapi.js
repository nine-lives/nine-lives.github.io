var nls = nls || {};
nls.components = nls.components || {};
nls.components.sdapi = nls.components.sdapi || {};
nls.components.sdapi = (function (namespace) {
    const currentScriptSrc = document.currentScript.src;
    const currentScriptPath = currentScriptSrc.substring(0, currentScriptSrc.lastIndexOf('/') + 1);

    class MediaDeviceSelector extends HTMLSelectElement {

        static observedAttributes = ['constraints', 'blank', 'default'];

        constructor() {
            super();
            this._constraints = new Set();
        }

        connectedCallback() {
            this._enumerateDevices();
            navigator.mediaDevices.addEventListener('devicechange', this._enumerateDevices.bind(this));
        }

        attributeChangedCallback(name, ov, nv) {
            if (name === 'constraints') {
                this._constraints = new Set();
                if (nv) {
                    nv.split(",").filter(o => o).forEach(o => this._constraints.add(o.trim()));
                }
            }

            if (this.devices && this.devices.length) {
                this.render();
            }
        }

        get selectedDevice() {
            if (this.devices && this.value) {
                return this.devices.find(o => (o.deviceId || o.groupId) === this.value);
            }

            return undefined;
        }

        get blank() {
            return this.getAttribute('blank');
        }

        set blank(blank) {
            this.setAttribute('blank', blank);
        }

        get constraints() {
            return this.getAttribute('constraints');
        }

        set constraints(constraints) {
            this.setAttribute('constraints', constraints);
        }

        get default() {
            return this.getAttribute('default');
        }

        set default(value) {
            this.setAttribute('default', value);
        }

        async _enumerateDevices() {
            this.devices = await navigator.mediaDevices.enumerateDevices();

            if (this.devices && this.devices[0].label === '') {
                await navigator.mediaDevices.getUserMedia({audio: true, video: true});
                this.devices = await navigator.mediaDevices.enumerateDevices();
            }

            this.render();
        }

        render() {
            this.innerHTML = '';
            if (this.blank) {
                const option = document.createElement('option');
                if (this.blank !== 'true') {
                    option.appendChild(document.createTextNode(this.blank));
                }
                this.appendChild(option);
            }

            let count = 1;
            this.devices.forEach(device => {
                const [kind, type, direction] = device.kind.match(/(\w+)(input|output)/i);
                if (this._constraints.size === 0 || this._constraints.has(kind) || this._constraints.has(type)) {
                    const textNode = document.createTextNode(device.label || `Device ${count++}: ${type} ${direction}`);
                    const option = document.createElement('option');
                    option.value = device.deviceId || device.groupId;
                    option.appendChild(textNode);
                    this.appendChild(option);

                    if (this.default &&
                        (device.deviceId === this.default || device.groupId === this.default || device.kind === this.default)) {
                        this.value = option.value;
                    }
                }
            });
        }
    }

    customElements.define("media-devices", MediaDeviceSelector, {extends: 'select'});
    namespace['MediaDeviceSelector'] = MediaDeviceSelector;

    class UserMediaVideo extends HTMLVideoElement {
        static observedAttributes = ['audio', 'facing-mode', 'video'];

        constructor() {
            super();
        }

        connectedCallback() {
            if (this.autoplay) {
                this.start();
            }
        }

        disconnectedCallback() {
            this.stop();
        }

        attributeChangedCallback() {
            if (this._mediaStream) {
                this.start();
            }
        }

        start() {
            if (this._mediaStream) {
                this.stop();
            }
            this._fetchUserMedia();
        }

        stop() {
            if (this._mediaStream) {
                this._mediaStream.getVideoTracks().forEach(t => {
                    t.stop();
                });
                this._mediaStream.getAudioTracks().forEach(t => {
                    t.stop();
                });
                this._mediaStream = null;
                this.srcObject = null;
                this.dispatchEvent(new CustomEvent("videoStopped", {
                    bubbles: true,
                    composed: true
                }));
            }
        }

        get mediaStream() {
            return this._mediaStream;
        }

        get video() {
            return this.getAttribute('video');
        }

        set video(video) {
            this.setAttribute('video', video);
            if (this._mediaStream) {
                this.start();
            }
        }

        get audio() {
            return this.getAttribute('audio');
        }

        set audio(audio) {
            this.setAttribute('audio', audio);
        }

        get facingMode() {
            return this.getAttribute('facing-mode');
        }

        set facingMode(facingMode) {
            this.setAttribute('facing-mode', facingMode);
        }

        _fetchVideoConstraints() {
            const videoInput = this.video;
            if (videoInput === 'false') {
                return false;
            } else if (videoInput && videoInput !== 'true') {
                return {
                    deviceId: videoInput
                }
            }

            const video = {};

            if (this.facingMode) {
                video.facingMode = this.facingMode;
            }

            return Object.keys(video).length === 0 ? true : video;
        }

        _fetchAudioConstraints() {
            const audioInput = this.audio;

            if (audioInput === 'false') {
                return false;
            } else if (audioInput && audioInput !== 'true') {
                return {
                    deviceId: audioInput
                }
            }

            const audio = {};
            return Object.keys(audio).length === 0 ? true : audio;
        }

        _fetchUserMedia() {
            const constraints = {
                audio: this._fetchAudioConstraints(),
                video: this._fetchVideoConstraints()
            };

            const promise = navigator.mediaDevices.getUserMedia(constraints);
            promise.then(mediaStream => {
                this._mediaStream = mediaStream;
                this.srcObject = this._mediaStream;
                this.play();

                this._mediaStream.getAudioTracks().forEach(t => {
                    console.log(t.label);
                });

                const currentConstraints = {
                    audio: this._fetchAudioConstraints(),
                    video: this._fetchVideoConstraints()
                };

                if(JSON.stringify(constraints) !== JSON.stringify(currentConstraints)) {
                    setTimeout(this.start.bind(this), 1);
                } else {
                    this.dispatchEvent(new CustomEvent("videoStarted", {
                        bubbles: true,
                        composed: true
                    }));
                }

            }).catch((e) => {
                console.log("error loading media " + e);
            });
        }
    }

    customElements.define("user-media", UserMediaVideo, {extends: 'video'});
    namespace['UserMediaVideo'] = UserMediaVideo;

    class BarcodeDecoderElement extends HTMLElement {
        static observedAttributes = ['width', 'aspectratio'];

        static PADDING_V = 0.15;

        static polyfillPromise;

        constructor() {
            super();
            this._polyfillIfNeededInit();
            this._last = {
                value: null,
                timestamp: 0,
                samples: []
            };
            this._scanning = false;
        }

        connectedCallback() {
            this._resizeCanvas();
            if (this._video) {
                this._video.autoplay = this.autostart;
            }
        }

        disconnectedCallback() {
            if (this._video) {
                this._video.stop();
            }
        }

        attributeChangedCallback(name, ov, nv) {
            if (this._video) {
                if ((name === 'width' || name === 'aspectratio') && ov !== nv) {
                    this._resizeCanvas();
                }
            }
        }

        get started() {
            return this._video && this._video.mediaStream;
        }

        get scanning() {
            return this._scanning;
        }

        get delay() {
            return this.getAttribute('delay')  || 0;
        }

        set delay(delay) {
            this.setAttribute('delay', delay);
        }

        get quorum() {
            return this.getAttribute('quorum')  || 3;
        }

        set quorum(quorum) {
            this.setAttribute('quorum', quorum);
        }

        get aspectRatio() {
            return this.getAttribute('aspectratio') || 0.5;
        }

        set aspectRatio(aspectRatio) {
            this.setAttribute('aspectratio', aspectRatio);
        }

        get autostart() {
            const val = this.getAttribute('autostart');
            return val == 'true' || val == 'on';
        }

        set autostart(autostart) {
            this.setAttribute('autostart', autostart);
            if (this._video) {
                this._video.autoplay = autostart;
                if (!this.started && autostart) {
                    this.start();
                }
            }
        }

        get continuous() {
            const val = this.getAttribute('continuous');
            return val == 'true' || val == 'on';
        }

        set continuous(continuous) {
            const lastState = this.continuous;
            this.setAttribute('continuous', continuous);
            if (continuous && !lastState) {
                this.scan()
            }
        }

        get video() {
            return this.getAttribute('video');
        }

        set video(video) {
            this.setAttribute('video', video);

            if (this._video) {
                this._video.video = video;
            }
        }

        start() {
            if (this._video) {
                this._video.start();
            }
        }

        stop() {
            this._video.stop();
        }

        scan() {
            if (this.started) {
                if (this._reinitTimer) {
                    clearTimeout(this._reinitTimer);
                }
                this._reinitTimer = setTimeout(this._reinitDecoder.bind(this), 2000);
                this._scanning = true;
                this._detector.detect(this._video)
                    .then(this._decoded.bind(this))
                    .catch((err) => {
                        this._scanning = false;
                        console.log(err)
                    });

                if (this.scanning) {
                    this.dispatchEvent(new CustomEvent("detectionStarted", {
                        bubbles: true,
                        cancelable: false,
                        composed: true
                    }));
                }

            } else {
                console.log("scan call ignored as video stream not playing")
                this.dispatchEvent(new CustomEvent("detectionStopped", {
                    bubbles: true,
                    cancelable: false,
                    composed: true
                }));
            }
        }

        static async _loadPolyfill(src) {
            if (!this.polyfillPromise) {
                this.polyfillPromise = new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = src;
                    script.onload = () => resolve(true);
                    script.onerror = () => reject(new Error('Failed to load script ' + src));
                    document.head.appendChild(script);
                });
            }

            await this.polyfillPromise;
        }

        async _polyfillIfNeededInit() {
            if (!('BarcodeDetector' in window)) {
                console.log("Using polyfilled BarcodeDetector")
                this._polyfilled = true;
                await BarcodeDecoderElement._loadPolyfill(currentScriptPath + "BarcodeDetector.min.js");
            } else {
                this._polyfilled = false;
            }

            this.init();
        }

        async init() {
            this._detector = new BarcodeDetector();
            this._shadow = this.attachShadow({mode: 'open'});
            this._canvas = document.createElement('canvas');
            this._canvas.style.position = 'absolute';
            this._canvas.style.top = 0;
            this._canvas.style.left = 0;
            this._workCanvas = document.createElement('canvas');
            this._workCanvas.style.display = 'none';
            this._video = document.createElement('video', {is: 'user-media'});
            this._video.audio = false;
            this._video.autoplay = this.autostart
            //this._video.video = this.video || null;

            this._video.facingMode = 'environment'
            this._video.style.display = 'none';
            this._style = document.createElement("style");
            this._style.textContent = `:host {
                display: block;
                position: relative;
                aspect-ratio: 1 / ${this.aspectRatio}
            }`

            this._shadow.appendChild(this._style);
            this._shadow.appendChild(this._canvas);
            this._shadow.appendChild(this._workCanvas);
            this._shadow.appendChild(this._video);
            this.style['aspect-ratio'] = '1 / ${this.aspectRatio}'

            this._resizeCanvas();

            const ro = new ResizeObserver((entries) => {
                this._resizeCanvas();
            });

            ro.observe(this);

            this._video.addEventListener('play', event => {
                if (this.continuous) {
                    this.scan();
                }
            });

            this._video.addEventListener('abort', event => {
                console.log("abort")
                this._resizeCanvas();
            });
        }

        _resizeCanvas() {
            const clientWidth = this.clientWidth ?  this.clientWidth : 600;
            const videoWidth = this._video ? this._video.videoWidth : 600;
            if (this._canvas) {
                this._style.textContent = `:host {
                        display: block;
                        position: relative;
                        aspect-ratio: 1 / ${this.aspectRatio}
                }`;
                this.initCanvasSize(clientWidth, Math.max(videoWidth, clientWidth), this.aspectRatio);
                this.drawFrame();
            }
        }

        _reinitDecoder() {
            console.log("reinitialising barcode detector")
            this._scanning = false;
            this._reinitTimer = null;
            this._detector = new BarcodeDetector();
            if (this.started) {
                this.scan();
            }
        }

        initCanvasSize(width, maxWidth, aspectRatio) {
            const newWidth = Math.min(width, maxWidth);
            this._canvas.width = newWidth;
            this._canvas.height = Math.ceil(newWidth * aspectRatio);
            this._workCanvas.width = this._canvas.width * (1 - 2 * BarcodeDecoderElement.PADDING_V * this.aspectRatio);
            this._workCanvas.height = this._canvas.height * (1 - 2 * BarcodeDecoderElement.PADDING_V);
        }

        drawFrame() {
            const ctx = this._canvas.getContext("2d");
            this.drawVideo(ctx);

            const wCtx = this._workCanvas.getContext("2d");

            // copy from view to work canvas - before drawing overlays
            const dw = this._workCanvas.width,
                dh = this._workCanvas.height,
                sw = dw,
                sh = dh,
                sx = this._canvas.width * BarcodeDecoderElement.PADDING_V * this.aspectRatio,
                sy = this._canvas.height * BarcodeDecoderElement.PADDING_V;
            wCtx.drawImage(this._canvas, sx, sy, sw, sh, 0, 0, dw, dh);

            this.drawLine(ctx);
            this.drawMask(ctx, sx, sy, sw, sh);

            // keep the cycle going
            this._raf = requestAnimationFrame(this.drawFrame.bind(this));
        }

        drawVideo(ctx) {
            const dw = this._canvas.width,
                dh = this._canvas.height,
                sw = this._video.videoWidth,
                sh = Math.ceil(dh / dw * sw),
                sx = Math.floor((this._video.videoWidth - sw) / 2),
                sy = Math.floor((this._video.videoHeight - sh) / 2);
            ctx.drawImage(this._video, sx, sy, sw, sh, 0, 0, dw, dh);
        }

        drawLine(ctx) {
            const dw = this._canvas.width,
                dh = this._canvas.height
            ctx.strokeStyle = this._polyfilled ? 'rgba(255, 0, 0, 0.9)' : 'rgba(0, 255, 0, 0.9)';
            ctx.beginPath();
            ctx.moveTo(dw * BarcodeDecoderElement.PADDING_V * this.aspectRatio, dh * 0.5);
            ctx.lineTo(dw * (1 - BarcodeDecoderElement.PADDING_V  * this.aspectRatio), dh * 0.5);
            ctx.stroke();
        }

        drawMask(ctx, x, y, w, h) {
            const ow = this._canvas.width, //outer width
                oh = this._canvas.height, // outer height
                vd = (oh - h) / 2, //vertical delta
                hd = (ow - w) /2; // horizontal delta

            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, 0, ow, vd);
            ctx.fillRect(0, oh - vd, ow, vd);
            ctx.fillRect(0, vd, hd, h);
            ctx.fillRect(ow - hd, vd, hd, h);
        }

        _decoded(results) {
            clearTimeout(this._reinitTimer);
            this._reinitTimer = null;

            if (results.length > 0) {
                const value = results[0].rawValue;
                this._last.samples.push(value);

                if (this._last.samples.length > this.quorum) {
                    this._last.samples.shift();
                }

                if (this._quorumAchieved() && (value !== this._last.value || Date.now() - this._last.timestamp >= this.delay)) {
                    this.dispatchEvent(new CustomEvent("barcodeDetected", {
                        detail: {results: results},
                        bubbles: true,
                        cancelable: false,
                        composed: true
                    }));

                    this._last.value = value;
                    this._last.timestamp = Date.now();
                    this._last.samples = [];
                    this._scanning = false;

                    if (this.continuous) {
                        this.scan();
                    } else {
                        this.dispatchEvent(new CustomEvent("detectionStopped", {
                            bubbles: true,
                            cancelable: false,
                            composed: true
                        }));
                    }

                    return;
                }

            }

            this.scan();
        }

        _quorumAchieved() {
            return this._last.samples.length >= this.quorum && this._last.samples.every(val => val === this._last.samples[0]);
        }

        render() {
        }
    }

    customElements.define("barcode-detector", BarcodeDecoderElement);
    namespace['BarcodeDecoderElement'] = BarcodeDecoderElement;
    return namespace;
})
(nls.components.sdapi);
