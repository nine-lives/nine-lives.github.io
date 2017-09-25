Number.MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
Number.MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER || -9007199254740991;

$(function () {
    $('.thermostat').each(function () {
        var that = $(this);
        var deviceId = that.data('device-id');
        var from = moment().subtract(3, 'day');
        var chart = null;
        console.log('device-id=' + deviceId);
        console.log('from=' + from.toISOString());

        function update() {
            $.ajax({
                url: "https://seller.stuffusell.co.uk/api/nest/list",
                method: 'POST',
                contentType: "application/json",
                dataType: 'json',
                data: JSON.stringify({
                    page: 0,
                    pageSize: 10000,
                    deviceId: deviceId,
                    fromTime: from.toISOString()
                }),
                success: function (response) {
                    console.log(response);
                    updateChart(response);
                },
                error: function (request, status, error) {
                },
                complete: function () {
                }
            });
        }

        function updateChart(data) {
            var results = data.results;
            // .sort(function (l, r) {
            //     return moment(l.eventTime).isBefore(moment(r.eventTime)) ? -1 : 1;
            // });
            var dataOptions = [
                {
                    property: 'tempTarget',
                    label: 'Target',
                    borderColor: "rgba(205,187,205,1)",
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    data: []
                },
                {
                    property: 'tempExternal',
                    label: 'Outside',
                    backgroundColor: "rgba(151,187,205,0.4)",
                    borderDash: [5, 5],
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    data: []
                },
                {
                    property: 'tempAmbient',
                    label: 'Inside',
                    borderColor: "rgb(124, 186, 0)",
                    backgroundColor: "rgba(124, 186, 0, 0.1)",
                    borderDash: [5, 5],
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    data: []
                },
                {
                    property: 'tempAmbient',
                    state: 'heating',
                    label: 'Heating On',
                    backgroundColor: "rgb(235, 109, 0)",
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    spanGaps: false,
                    lineTension: 0,
                    steppedLine: 0,
                    data: []
                }
            ];
            for (var i = 0; i < results.length; ++i) {
                var time = moment(results[i].eventTime);
                for (var j = 0; j < dataOptions.length; ++j) {
                    if (typeof  dataOptions[j].state === 'undefined' || results[i]['state'] === dataOptions[j].state) {
                        dataOptions[j].data.push({
                            x: time.toDate(),
                            y: results[i][dataOptions[j].property]
                        });
                    } else {
                        dataOptions[j].data.push({
                            x: time.toDate(),
                            y: 0
                        });
                    }
                }
            }

            var ctx = $(that.find('.temperature-chart')[0]);
            if (chart) {
                chart.destroy();
            }

            chart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: dataOptions
                },
                options: {
                    scales: {
                        xAxes: [{
                            type: "time",
                            time: {
                                unit: 'hour'
                            },
                            display: true,
                            scaleLabel: {
                                display: true,
                                labelString: 'Time'
                            },
                            min: from.toDate()
                        }],
                        yAxes: [{
                            ticks: {
                                //beginAtZero: true
                            }
                        }]
                    }
                }
            });
        }

        update();
    });
});

