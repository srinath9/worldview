$(function() {// Initialize "static" vars

    var log = Logging.getLogger();
    var loaded = false;

    var entryPoint = function() {

        // Error handlers
        Worldview.Events.errorHandler = function(error) {
            Worldview.error("Internal error", error);
        };

        // Place any quirky browser related items in the function called
        // below.
        Worldview.Support.quirks();

        // A message can be displayed to the user (for example, notification
        // of a pending outage) by adding a notice.txt file in the web root
        $.get("var/notice.txt", function(message) {
            var html = message.replace(/\n/g, "<br/>");
            Worldview.notify(html);
        });

        // Place any resources that should be completely loaded before
        // starting up the UI
        Worldview.Preloader([
            "images/activity.gif",
            { id: "config", type:"json",
              src: "data/config.json?v=" + Worldview.BUILD_NONCE },
            // FIXME: Projection cache HACK
            { id: "geographic", type: "json",
              src: "data/geographic_ap_products.json?v=" + Worldview.BUILD_NONCE },
            { id: "arctic", type: "json",
              src: "data/arctic_ap_products.json?v=" + Worldview.BUILD_NONCE },
            { id: "antarctic", type: "json",
              src: "data/antarctic_ap_products.json?v=" + Worldview.BUILD_NONCE },
            "images/permalink.png",
            "images/geographic.png",
            "images/arctic.png",
            "images/antarctic.png",
            "images/camera.png",
            "images/cameraon.png",
            "images/information.png",
            "images/expandIn.png",
            "images/expandOut.png",
            "images/visible.png",
            "images/invisible.png",
            "images/close-red-x.png",
            "images/collapseDown.png",
            "images/expandUp.png",
            "images/wv-icons.svg",
            "images/wv-logo.svg"
        ]).execute(onLoad);
        setTimeout(function() {
            if ( !loaded ) {
                Worldview.Indicator.loading();
            }
        }, 2000);
    };

    var onLoad = function(queue) {
        try {
            var config = queue.getResult("config");
            // Convert all parameters found in the query string to an object,
            // keyed by parameter name
            config.parameters = Worldview.queryStringToObject(location.search);

            // FIXME: Projection cache HACK
            config.ap_products = {
                geographic: queue.getResult("geographic"),
                arctic: queue.getResult("arctic"),
                antarctic: queue.getResult("antarctic")
            };

            if ( config.parameters.loadDelay ) {
                var delay = parseInt(config.parameters.loadDelay);
                log.warn("Delaying load for " + delay + " ms");
                setTimeout(function() {
                    init(config);
                }, parseInt(config.parameters.loadDelay));
            } else {
                init(config);
            }
        } catch ( error ) {
            Worldview.error("Unable to start Worldview", error);
        }
    };
    var storageEngine;
    var init = function(config) {
        loaded = true;
        Worldview.Indicator.hide();

    	// set up storage and decide what to show
        try {
            storageEngine = YAHOO.util.StorageManager.get(
                YAHOO.util.StorageEngineHTML5.ENGINE_NAME,
                YAHOO.util.StorageManager.LOCATION_LOCAL,
                {
                    force: false,
                    order: [
                        YAHOO.util.StorageEngineHTML5
                    ]
                });
        } catch(e) {
            alert("No supported storage mechanism present");
            storageEngine = false;
        }

        var hideSplash, eventsCollapsed, lastVisit;
        if(storageEngine) {
            storageEngine.subscribe(storageEngine.CE_READY, function() {
                hideSplash = storageEngine.getItem('hideSplash');
                eventsCollapsed = storageEngine.getItem('eventsCollapsed');
                lastVisit = storageEngine.getItem('lastVisit');
            });

            if(!lastVisit) {
            	lastVisit = Date.now();
            }
            storageEngine.setItem('lastVisit', Date.now());
            // FIXME: Hacking in for now
            Worldview.storageEngine = storageEngine;
        }
        //var lastVisitObj = new Date(lastVisit);
        var lastVisitObj = new Date("2013-04-07T00:00:00-04:00"); // FIXME
        // get query string
        var queryString =
            Worldview.Permalink.decode(window.location.search.substring(1));

        // Features that are important for debugging but are not necessary
        // for Worldview to opeerate properly
        debuggingFeatures(config);

        // Models
        var dataDownloadModel = Worldview.DataDownload.Model(config);

        // Create widgets
        var projection = new SOTE.widget.Switch("switch", {
            dataSourceUrl:"a",
            selected:"geographic"
        });
        var palettes = Worldview.Widget.Palette("palettes", config, {
            alignTo: "#products"
        });
        var products = new SOTE.widget.Products("productsHolder", {
            paletteWidget: palettes,
            config: config
        });
        var date = new SOTE.widget.DatePicker("time", {
            hasThumbnail: false
        });
        var map = Worldview.Widget.WorldviewMap("map", config);
        var rubberBand = new SOTE.widget.RubberBand("camera", {
            icon: "images/camera.png",
            onicon: "images/cameraon.png",
            cropee: "map",
            paletteWidget: palettes,
            mapWidget: map
        });
        var imageDownload = new SOTE.widget.ImageDownload("imagedownload", {
            baseLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",
            alignTo: rubberBand,
            m: map,
            config: config
        });
        var apcn = new Worldview.Widget.ArcticProjectionChangeNotification(
            config, products.b
        );
        var opacity = new Worldview.Widget.Opacity(config);
        var crs = new Worldview.Widget.CRS(config);

        // collapse events if worldview is being loaded via permalink
        if(queryString) {
        	eventsCollapsed = true;
        }
        if ( config.parameters.events ) {
    		var events = new SOTE.widget.Events("eventsHolder", {
    		    config: config,
    		    mapWidget: map,
      		    paletteWidget: palettes,
                switchWidget: projection,
    		    bankWidget: products,
    		    dateWidget: date,
    		    apcmWidget: apcn,
    		    wvOpacity: opacity,
    		    wvEPSG: crs,
    		    shouldCollapse: eventsCollapsed,
    		    lastVisit: lastVisitObj
    	    });
	    }

        var dataDownload = Worldview.Widget.DataDownload(config, {
            selector: "#DataDownload",
            model: dataDownloadModel,
            maps: map.maps,
            paletteWidget: palettes
        });
        dataDownload.render();
        $(window).resize(function() {
          if ($(window).width() < 720) {
            $('#productsHoldertabs li.first a').trigger('click');
          }
        });
        // Wirings
        products.events
            .on("dataDownloadSelect", function() {
                dataDownloadModel.activate();
            })
            .on("dataDownloadUnselect", function() {
                dataDownloadModel.deactivate();
            });
        dataDownloadModel.events
            .on("activate", function() {
                products.selectTab("download");
            });
        map.maps.events
            .on("moveEnd", function(map) {
                dataDownload.onViewChange(map);
            })
            .on("zoomEnd", function(map) {
                dataDownload.onViewChange(map);
            });
        dataDownloadModel.events
            .on("queryResults", function() {
                dataDownload.onViewChange(map.maps.map);
            });
	    // Register event listeners
        REGISTRY.addEventListener("time",
                "map", "imagedownload", apcn.containerId, crs.containerId,
                dataDownload.containerId);
        REGISTRY.addEventListener("switch",
                "map", "products", "selectorbox", "imagedownload", "camera",
                apcn.containerId, crs.containerId, dataDownload.containerId);
        REGISTRY.addEventListener("products",
                "map", "selectorbox", "imagedownload", "palettes",
                apcn.containerId, dataDownload.containerId);
        REGISTRY.addEventListener("selectorbox","products");
        REGISTRY.addEventListener("camera","imagedownload");
        REGISTRY.addEventListener("palettes","map","camera","products");
        REGISTRY.addEventListener("opacity", "map");
        REGISTRY.addEventListener(crs.containerId, "imagedownload");

        // These are only convienence handles to important objects used
        // for console debugging. Code should NOT reference these as they
        // are subject to change or removal.
        Worldview.config = config;
        Worldview.opacity = opacity;
        Worldview.palettes = palettes;
        Worldview.view = map;
        Worldview.ddm = dataDownloadModel;
        Worldview.maps = map.maps;

        // Initialize widgets

        var initOrder = [
            projection,
            products.b, // bank
            date,
            map,
            palettes,
            apcn,
            opacity,
            crs,
            dataDownload
        ];

        // Init
        if (queryString.length > 0) {
            REGISTRY.isLoadingQuery = true;
            $.each(initOrder, function(index, component) {
                component.loadFromQuery(queryString);
            });
            REGISTRY.isLoadingQuery = false;
        }

        // Console notifications
        var banner = Worldview.NAME + " - Version " + Worldview.VERSION;
        if ( !Worldview.isDevelopment() ) {
            banner += " - " + Worldview.BUILD_TIMESTAMP;
        }
        log.info(banner);
        if ( Worldview.isDevelopment() ) {
            log.warn("Development version");
        }

        // Do not start the tour if coming in via permalink
        if ( !queryString ) {
            Worldview.Tour.start(storageEngine, hideSplash, false);
        }

        if ( events ) {
            window.onbeforeunload = function(){
        		storageEngine.setItem('eventsCollapsed', events.isCollapsed);
      		};
  		}
    };

    var debuggingFeatures = function(config) {
        // Allow the current day to be overridden
        if ( config.parameters.now ) {
            try {
                var now = Date.parseISOString(config.parameters.now);
                Worldview.overrideNow(now);
                log.warn("Overriding now: " + now.toISOString());
            } catch ( error ) {
                log.error("Invalid now: " + query.now, error);
            }
        }

        // Install a black palette which can be used to find "holes" in
        // LUT mappings.
        if ( config.parameters.debugPalette ) {
            var debugPalette = Worldview.Palette.Palette({
                id: "__DEBUG",
                name: "Debug",
                stops: [{at: 0, r: 0, g: 0, b: 0, a: 0}]
            });
            config.palettes["__DEBUG"] = debugPalette;
            config.paletteOrder.unshift("__DEBUG");
        }
    };

    try {
        entryPoint();
    } catch ( cause ) {
        Worldview.error("Failed to start Worldview", cause);
    }

});
