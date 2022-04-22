var nls = nls || {};
nls.components = nls.components || {};
nls.components.sdapi = nls.components.sdapi || {};
nls.components.sdapi = (function(namespace) {

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

        get blank() { return this.getAttribute('blank'); }
        set blank(blank) { this.setAttribute('blank', blank); }

        get constraints() { return this.getAttribute('constraints'); }
        set constraints(constraints) { this.setAttribute('constraints', constraints); }

        get default() { return this.getAttribute('default'); }
        set default(value) { this.setAttribute('default', value); }

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
    customElements.define("media-devices", MediaDeviceSelector, { extends: 'select'});
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
            }
        }

        get mediaStream() {
            return this._mediaStream;
        }

        get video() { return this.getAttribute('video'); }
        set video(video) { this.setAttribute('video', video); }

        get audio() { return this.getAttribute('audio'); }
        set audio(audio) { this.setAttribute('audio', audio); }

        get facingMode() { return this.getAttribute('facing-mode'); }
        set facingMode(facingMode) { this.setAttribute('facing-mode', facingMode); }

        _fetchVideoConstraints() {
            const videoInput = this.video;

            if (videoInput === 'false') {
                return false;
            }

            else if (videoInput && videoInput !== 'true') {
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
            }

            else if (audioInput && audioInput !== 'true') {
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

            console.log(constraints);

            const promise = navigator.mediaDevices.getUserMedia(constraints);
            promise.then(mediaStream => {
                this._mediaStream = mediaStream;
                this.srcObject = this._mediaStream;
                this.play();

                this._mediaStream.getAudioTracks().forEach(t => {
                    console.log(t.label);
                })
            });
        }
    }
    customElements.define("user-media", UserMediaVideo, { extends: 'video'});
    namespace['UserMediaVideo'] = UserMediaVideo;

    class BarcodeDecoderElement extends HTMLElement {
        static polyfillPromise;

        constructor() {
            super();
            this._polyfillIfNeededInit();
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
                await BarcodeDecoderElement._loadPolyfill("src/BarcodeDetector.min.js");
            }

            this.init();
        }

        async init() {
            this.canvas = document.createElement('canvas');
            this.video = document.createElement('video');
            this.appendChild(this.canvas);
            this.appendChild(this.video);
        }

        render() {

        }
    }

    customElements.define("barcode-detector", BarcodeDecoderElement);
    namespace['BarcodeDecoderElement'] = BarcodeDecoderElement;
    return namespace;
})(nls.components.sdapi);
