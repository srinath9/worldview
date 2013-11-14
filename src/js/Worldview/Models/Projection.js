/*
 * NASA Worldview
 *
 * This code was originally developed at NASA/Goddard Space Flight Center for
 * the Earth Science Data and Information System (ESDIS) project.
 *
 * Copyright (C) 2013 United States Government as represented by the
 * Administrator of the National Aeronautics and Space Administration.
 * All Rights Reserved.
 */

Worldview.namespace("Models");

Worldview.Models.Projection = function(config) {

    var log = Logging.getLogger("Worldview.Models.Projection");

    var self = {};

    self.selected = null;
    self.epsg = null;
    self.crs = null;
    self.events = Worldview.Events();

    var init = function() {
        self.set(config.defaults.projection);
    };

    self.set = function(projection) {
        var p = config.projections[projection];
        if ( !p || p.virtual ) {
            throw new Error("Invalid projection: " + projection);
        }
        if ( self.selected === projection ) {
            return;
        }
        self.selected = p.name;
        self.epsg = p.epsg;
        self.crs = p.crs;
        self.events.trigger("change", self.selected, {
            projection: self.selected,
            epsg: self.epsg,
            crs: self.crs
        });
        log.debug("projection", "change", self.selected, self.epsg, self.crs);
    };

    self.toPermalink = function() {
        return "switch=" + self.selected;
    };

    self.fromPermalink = function(queryString) {
        var query = Worldview.queryStringToObject(queryString);
        var projection = query.projection || query["switch"];
        if ( projection ) {
            if ( !config.projections[projection] ) {
                log.warn("Unsupported projection: " + projection);
            } else {
                self.set(projection);
            }
        }
    };

    init();
    return self;

};