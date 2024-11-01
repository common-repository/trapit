window.TRAPIT = window.TRAPIT || {};

(function () {
    var queue_items_div = "trapit-body-masonry";
    var iso;

    function fetch_json_then(url, action, options) {
        // fetch JSON
        var args = [url];
        if (options) {
            args.push(options);
        }

        return fetch.apply(null, args).then(
            function (response) {
                switch (response.status) {
                case 200:
                    // Examine the text in the response
                    return response.json().then(action(options));
                case 204:
                    // no documents in queue
                    console.log("Trap is empty. Status Code: 204");
                    var d = div("message no-content",
                                "This trap has no candidate content. Please check again later for content.");
                    var element = d.getElements();
                    var trapit_body_masonry = TRAPIT.ROOT.querySelector(".trapit-body-masonry");

                    // empty out any current contents of the target div and show no-content message
                    var new_div = trapit_body_masonry.cloneNode(false);
                    new_div.appendChild(element);
                    trapit_body_masonry.parentNode.replaceChild(new_div, trapit_body_masonry);
                    break;
                default:
                    console.log('Looks like there was a problem. Status Code: ' +
                                response.status);
                }
            }
        ).catch(function (err) {
            console.log('Fetch Error: ', err);
        });
    }


    function load_queue_items(options) {
        return function (data, append) {
            var next = data.next;
            var prev = data.prev;
            var records = data.records || [];

            if (!TRAPIT.ROOT) {
                console.log("Attempted to load queue items before root element was created.");
                return;
            }

            var div = TRAPIT.ROOT.querySelector("." + queue_items_div);

            if (!append) {
                // empty out any current contents of the target div
                var new_div = div.cloneNode(false);
                new_div.style.display = 'none';
                div.parentNode.replaceChild(new_div, div);
                div = new_div;
            }

            var new_items = records.map(function (record, i) {
                var doc = record.document;
                var sizes = record.document_overlay_images.sizes[0].url ?
                    record.document_overlay_images.sizes : (doc.images.sizes || []);
                var image_url_320;
                var image_url_full;
                var dimensions;
                var overlays = {};
                if (record.annotation) {
                    overlays.annotation = record.annotation;
                }
                if (record.document_overlay_summary) {
                    overlays.summary = record.document_overlay_summary;
                }
                if (record.document_overlay_title) {
                    overlays.title = record.document_overlay_title;
                }

                sizes.forEach(function (size, j) {
                    if (!size.dimensions || size.dimensions.lastIndexOf('320x', 0)) {
                        image_url_full = size.url;
                    } else {
                        image_url_320 = size.url;
                        dimensions = size.dimensions.split("x");
                    }
                });

                if (image_url_320 && !image_url_full) {
                    image_url_full = image_url_320;
                }
                if (image_url_full && !image_url_320) {
                    image_url_320 = image_url_full;
                }
                var image_urls = image_url_320 ? [image_url_320, image_url_full] : [];

                return create_item(record, image_urls, dimensions, overlays);
            });

            new_items.forEach(function (item) {
                div.appendChild(item);
            });

            if (!append) {
                div.style.display = '';

                // init Isotope
                iso = new Isotope(div, {
                    // options
                    itemSelector: '.trapit-masonry-item',
                    layoutMode: 'masonry',
                    columnWidth: 324,
                    gutter: 40 //,
                    //"isOriginLeft": true
                });
            } else {
                iso.appended(new_items);
                //iso.layout();
            }

            imagesLoaded(div, function () {
                iso.arrange();
            });

            var app = TRAPIT.ROOT.querySelector(".app");
            var trapit_body_masonry = TRAPIT.ROOT.querySelector(".trapit-body-masonry");
            var wpadminbar = document.getElementById("wpadminbar");

            var loading_prev = false;
            window.onscroll = function (event) {
                if (loading_prev) {
                    return;
                }
                var body_height = trapit_body_masonry.offsetHeight; //document.getElementsByTagName("body")[0].offsetHeight;
                // if body_height - pageYOffset <= innerHeight, we're 100% scrolled to bottom
                var total = body_height - innerHeight;
                var bottom = total - pageYOffset;
                if (bottom <= 100) {
                    loading_prev = true;
                    enable_queue_spinner();
                    // infinite scroll here
                    //  fetch previous bundle of data
                    //   pass to load_queue_items with append set to true
                    (options ? fetch(prev, options) : fetch(prev)).then(function (response) {
                        disable_queue_spinner();
                        switch (response.status) {
                        case 200:
                            response.json().then(function (data) {
                                load_queue_items(options)(data, true);
                            });
                            break;
                        case 204:
                            // 204 is sent when the queue is extinguished
                            break;
                        default:
                            console.log('Looks like there was a problem fetching ' + prev + '\n Status Code: ' +
                                        response.status);
                        }
                    }).catch(function (err) {
                        disable_queue_spinner();
                        console.log('Fetch Error: ', err);
                    });
                }
            };

            jQuery(trapit_body_masonry).resize(function (event) {
                console.log(event);
                app.style.minHeight = wpadminbar.clientHeight + trapit_body_masonry.clientHeight + "px";
            });

            app.style.minHeight = wpadminbar.clientHeight + trapit_body_masonry.clientHeight + "px";
        };
    }


    var p = Ele("p");
    var div = Ele("div");
    var span = Ele("span");
    var article = Ele("article");
    var figure = Ele("figure");
    var img = Ele("img");
    var italic = Ele("i");
    var a = Ele("a");
    var section = Ele("section");
    var textarea = Ele("textarea");

    var input = Ele("input");
    var form = Ele("form");
    var button = Ele("button");

    function create_item(record, image_urls, dimensions, overlays) {
        var doc = record.document;
        var source = record.source.name;
        var summary = overlays.summary || doc.summary;
        var title = overlays.title || doc.title;
        var primary_name = record.trap.name.toUpperCase();
        if (primary_name === "AGGREGATE TRAP") {
            primary_name = record.origin.name.toUpperCase();
        }

        var image;
        var image_url = image_urls[0];
        var image_url_full = image_urls[1];
        var img_opts = {src: image_url};
        var img_class = "article-img";
        if (image_url) {
            if (dimensions && dimensions.length) {
                img_opts.width = dimensions[0];
                img_opts.height = dimensions[1];
            } else {
                img_class += " dimensionless";
            }
            image = img(img_class, null, img_opts);
        }

        var post_form = form("post-form", [input(null, null, {type: "hidden",
                                                              value: title,
                                                              name: "trapit_title"}),
                                           input(null, null, {type: "hidden",
                                                              value: summary,
                                                              name: "trapit_summary"}),
                                           input(null, null, {type: "hidden",
                                                              value: doc.original,
                                                              name: "trapit_original"}),
                                           input(null, null, {type: "hidden",
                                                              value: image_url_full,
                                                              name: "trapit_image_url"}),
                                           input(null, null, {type: "hidden",
                                                              value: doc.id,
                                                              name: "trapit_id"}),
                                           input(null, null, {type: "hidden",
                                                              value: "Y",
                                                              name: "trapit_submit_hidden"})
                                          ],
                             {"method": "post", "action": ""});

        var published = new Date(1000 * doc.published);
        published = format_published(published);
        var icon_share_data_uri = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUiIGhlaWdodD0iMTUiIHZpZXdCb3g9IjAgMCAxNSAxNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+c2hhcmU8L3RpdGxlPjxnIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik03LjUgMkgydjExaDExVjcuNU03IDhsNi02TTkgMWg1djUiLz48L2c+PC9zdmc+';
        var icon_share_btn = button("btn btn-main", "POST", {title: "POST", type: "button"});
        var clearfix = div("clearfix");
        var href_target = {href: doc.original, target: "_blank"};

        var content = []
        if (overlays.annotation) {
            content.push(
                div("comment-box",
                    div("comment-content",
                        [div("comment-editor", textarea("inline-edit-textarea", overlays.annotation, {rows: "1", readonly: ""}))
                         //span("arrow")
                        ])));
        }
        content.push(
            article(null,
                    [figure(null, [div("notification", span("message")),
                                   a("", [div("preload-bg"),
                                          image],
                                     href_target)
                                  ]),
                     section(null, [a("primary-name", primary_name),
                                    div("title is-read-only", [p("", a("section-title-rel", span("section-title-span", title), {href: doc.original, target: "_blank"}))] //, skipping some markup / clearfix stuff
                                       ),
                                    div("source-info", source.toUpperCase()),
                                    div("summary is-read-only", p("summary-p", a("summary-rel", span("summary-span", summary),
                                                                                 href_target)) // summary edit actions here?
                                       )]),
                     div("info date-info", span("publish-date", published)),
                     clearfix,
                     div("action", [icon_share_btn, clearfix]),
                     post_form,
                     clearfix]));
        var item = div("trapit-masonry-item masonry item enduser landing is-read-only animate-items-enter animate-items-enter-active", content);
        var item_elements = item.getElements();
        return item_elements;
    }

    function Ele(eletype) {
        return function (description, contents, opts) {
            return {
                description: description,
                contents: contents,
                opts: opts,
                getElements: function () {
                    var element = document.createElement(eletype);
                    var contents = this.contents;

                    if (this.description) {
                        element.className = this.description;
                    }

                    if (contents) {
                        if (!Array.isArray(contents)) {
                            contents = [contents];
                        }
                        contents.forEach(function (content) {
                            if (content) {
                                if (typeof content === "string") {
                                    element.appendChild(document.createTextNode(content));
                                } else {
                                    // assume a single Ele object
                                    element.appendChild(content.getElements());
                                }
                            }
                        });
                    }

                    if (this.opts) {
                        for (var key in this.opts) {
                            // use setAttribute for element.dataset compatibility
                            element.setAttribute(key, this.opts[key]);
                        }
                    }
                    return element;
                }
            };
        };
    }

    function format_published(date) {
        var date_string = date.toLocaleString("en-US", {month: "long",
                                                        year: "numeric",
                                                        day: "numeric",
                                                        hour: "numeric",
                                                        minute: "numeric"});
        var i = date_string.lastIndexOf(',');
        return date_string.substr(0, i) + " -" + date_string.substr(i + 1).toLowerCase();
    }

    function get_delay_promise(delay) {
        delay = delay || 5000;
        return function (result) {
            return new Promise(function (resolve, reject) {
                setTimeout(function () {
                    resolve(result);
                }, delay);
            });
        };
    }

    function enable_queue_spinner() {
        var trapit_body = TRAPIT.ROOT.querySelector(".trapit-body-masonry");
        var spinner = document.createElement("div");
        spinner.className = "trapit-queue-spinner";
        trapit_body.appendChild(spinner);
    }

    function disable_queue_spinner() {
        var spinners = TRAPIT.ROOT.querySelectorAll(".trapit-queue-spinner");
        Array.prototype.forEach.call(spinners, function (spinner) {
            spinner.parentNode.removeChild(spinner);
        });
    }

    function load_template() {
        var trapit_window = document.getElementById("trapit-window");
        var root = trapit_window.createShadowRoot();
        var template = document.getElementById("trapit-template");
        var clone = document.importNode(template.content, true);
        root.appendChild(clone);

        TRAPIT.ROOT = root;
    }

    function hide_sidebar_traps() {
        var all_category_traps = TRAPIT.ROOT.querySelectorAll(".trapit-category-trap");
        var i = all_category_traps.length;
        while (i--) {
            all_category_traps[i].style.display = "none";
        }
    }

    function get_fetch_options(overrides) {
        var authorization = trapit_opt_vals["trapit_user_id"] + ":" + trapit_opt_vals["trapit_api_key"];

        authorization = "Basic " + btoa(authorization);
        var options = {
            method: 'GET',
            //mode: "cors-with-forced-preflight",
            headers: {
                Accept: 'application/json',
                Authorization: authorization
            }
        };

        if (overrides) {
            for (var key in overrides) {
                options[key] = overrides[key];
            }
        }

        return options;
    }

    function load_alligator_view(category_id) {
        // show the alligator view for the category

        // sample curl query:
        // curl -u "{trapit_opt_vals["trapit_user_id"]}:<session>" -L https://{trapit_opt_vals["trapit_hostname"]}/api/v3/{trapit_opt_vals["trapit_slug"]}/aggregates/team_id={team-id}&category_id={category_id}&public=true&content_type='text'&visible=false/ -X GET
        // full sample URL:
        // "https://test8.trap.it/api/v3/t8/aggregates/category_id=9f079202fd3f41debe295bb591c49311&public=true&visible=true/"

        var url = ["https://", trapit_opt_vals["trapit_hostname"],
                   "/api/v3/", trapit_opt_vals["trapit_slug"], "/aggregates/",
                   (category_id !== "0" ? "category_id=" + category_id + "&": ""),
                   "public=true",
                   "&visible=true",
                   // endpoint does not support random such as: "&random=", Math.random(),
                   "/"].join("");

        // fetch the URL, get response, fetch queue items with response info
        var options = get_fetch_options();
        fetch(url, options).then(
            function (response) {
                switch (response.status) {
                case 202:
                    // documentation says to look for a 202 response
                case 201:
                    // actually receive a 201 response upon first call

                    response.json().then(fetch_json_then(url, load_queue_items, options));
                    break;
                case 200:
                    // alligator had been previously created
                    // handle response by loading the returned items
                    response.json().then(load_queue_items(options));
                    break;
                case 204:
                    // no documents available
                    console.log("Trap is empty. Status Code: 204");
                    var d = div("message no-content",
                                "This trap has no candidate content. Please check again later for content.");
                    var element = d.getElements();
                    var trapit_body_masonry = TRAPIT.ROOT.querySelector(".trapit-body-masonry");

                    // empty out any current contents of the target div and show no-content message
                    var new_div = trapit_body_masonry.cloneNode(false);
                    new_div.appendChild(element);
                    trapit_body_masonry.parentNode.replaceChild(new_div, trapit_body_masonry);
                    break;
                default:
                    console.log('Looks like there was a problem. Status Code: ' +
                                response.status);
                }
            }).catch(function (err) {
                console.log('Fetch Error: ', err);
            });
    }


    function trapit_get_data_id(element, element_type) {
        return element.getAttribute('data-' + element_type + '-id');
    }


    function add_listeners() {
        var app = TRAPIT.ROOT.querySelector(".app");
        delegate(app, "article .action", "click", submit_action);
        delegate(app, ".trapit-category-trap", "click", trap_name_click_handler);
        delegate(app, ".trapit-category-header", "click", trap_category_click_handler);
        app.querySelector(".all-traps").addEventListener("click", all_traps_click_handler, false);
        //jQuery(document).scroll(trapitScrollHandler);
    }

    function submit_action(e) {
        var form_element = this.parentNode.querySelector("form");
        form_element.submit();
        e.preventDefault();
    }

    function trap_name_click_handler(e) {
        var trap_id = trapit_get_data_id(this, "trap");
        var active_traps = this.parentNode.querySelectorAll(".trapit-category-trap.active");
        Array.prototype.forEach.call(active_traps, function (active_trap) {
            active_trap.classList.remove("active");
        });
        this.classList.add("active");

        // Old URL format
        //$url = "https://{$opt_vals[trapit_hostname]}.trap.it/api/v4/{$opt_vals[trapit_slug]}/traps/{$trap_id}/queue/?pretty=true&type=bundle&size=500";
        var url = "https://" + trapit_opt_vals["trapit_hostname"] + "/api/v4/" + trapit_opt_vals["trapit_slug"] + "/traps/" + trap_id + "/queue/?pretty=true&type=bundle&size=20";

        console.debug("Inside trap_name_click_handler");

        fetch_json_then(url, load_queue_items);

        e.preventDefault();
    }

    function trap_category_click_handler(e) {
        var th = this;
        var traps = next_until(th, ".trapit-category-header");
        var actives = th.parentNode.querySelectorAll(".active");
        var this_is_active = th.classList.contains("active");
        var all_traps_div = TRAPIT.ROOT.querySelector(".all-traps");
        var category_id = trapit_get_data_id(th, "category");

        console.debug("Inside trap_category_click_handler");

        hide_sidebar_traps();

        all_traps_div.classList.remove("active");
        Array.prototype.forEach.call(actives, function (header) {
            header.classList.remove("active");
        });

        // toggle activity
        if (!this_is_active) {
            th.classList.add("active");
            // show the category's traps
            traps.forEach(function (trap) {
                trap.style.display = "block";
            });

            load_alligator_view(category_id);
        }

        e.preventDefault();
    }

    function all_traps_click_handler(e) {
        var url = "https://" + trapit_opt_vals["trapit_hostname"] + "/api/v4/" + trapit_opt_vals["trapit_slug"] + "/public-traps/queue/?url=20";
        var all_traps = TRAPIT.ROOT.querySelector(".all-traps");
        var active_headers = all_traps.parentNode.querySelectorAll(".trapit-category-header.active");

        console.debug("Inside trapit_all_traps_click_handler", e);
        hide_sidebar_traps();
        Array.prototype.forEach.call(active_headers, function (header) {
            header.classList.remove("active");
        });
        all_traps.classList.add("active");

        fetch_json_then(url, load_queue_items);

        if (e)
            e.preventDefault();
    }

    function delegate(top_element, selector, event_type, handler) {
        top_element.addEventListener(event_type, function (e) {
            // iterate up the DOM tree until a matching node is found
            // or we pass the top_element
            for (var retarget = e.target;
                 retarget && retarget != top_element.parentNode;
                 retarget = retarget.parentNode) {

                if (retarget.matches(selector)) {
                    // if handler returns truthy, continue with delegation
                    if (!handler.call(retarget, e)) {
                        break;
                    }
                }
            }
        }, false);
    }

    function next_until(start_element, selector) {
        for (var sibling = start_element, keepers = [];
             (sibling = sibling.nextElementSibling) && !sibling.matches(selector);
             keepers.push(sibling));
        return keepers;
    }

    /***
        Set up left column
    ***/


    // Mimic PHP array_flip function
    function array_flip(hashmap) {
        var flipped = {};

        Object.keys(hashmap).forEach(function (key) {
            flipped[hashmap[key]] = key;
        });

        return flipped;
    }


    // Mimic PHP array_intersect_key function
    function array_intersect_key() {
        var intersection = {};
        var len = arguments.length;
        var master = arguments[0];
        var master_keys = Object.keys(master);
        var obj;

        for (var i = 1; i < len; ++i) {
            obj = arguments[i];
            master_keys.forEach(master_keys_intersect);
        }

        function master_keys_intersect(key) {
            if (obj.hasOwnProperty(key)) {
                intersection[key] = master[key];
            }
        }

        return intersection;
    }

    // Convert a hashmap into an array of key-value pairs
    function hashmap_to_array(hashmap) {
        return Object.keys(hashmap).map(function (key) {
            return [key, hashmap[key]];
        });
    }


    // all arguments should be empty objects
    function fetch_categories_traps(category_ids_names, category_ids_traps, trap_ids_names) {
        var opt_vals = trapit_opt_vals;

        // no-slings-out=true in the URL below prevents "feeder" traps from showing up
        var url = "https://" + opt_vals["trapit_hostname"] + "/api/v4/" +
            opt_vals["trapit_slug"] + "/public-traps/?pretty=true&type=bundle&size=500&no-slings-out=true";

        return TRAPIT.fetch_json_then(url, load_categories_traps);

        function load_categories_traps(options) {
            return function (body) {
                // pluck out & display desired values from body
                var next = body.next;
                var prev = body.prev;
                var records = body.records;

                // iterating public traps
                records.forEach(function (record) {
                    var associate_ids = function (category) {
                        category_ids_names[category.id] = category.name;
                        if (!category_ids_traps.hasOwnProperty(category.id)) {
                            category_ids_traps[category.id] = [];
                        }
                        category_ids_traps[category.id].push(record.id);
                    };

                    trap_ids_names[record.id] = record.name;

                    if (record.categories.length) {
                        record.categories.forEach(associate_ids);
                    } else {
                        // trap has no category associated with it
                        // create an Other category
                        associate_ids({"id": "0", "name": "Other"});
                    }
                });
            };
        }
    }

    function left_column_loader() {
        var category_ids_names = {}, category_ids_traps = {}, trap_ids_names = {};
        return fetch_categories_traps(category_ids_names, category_ids_traps, trap_ids_names).then(function () {
            var icon_minus = img('icon-minus', null, {title: "Collapse", src: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTEiIGhlaWdodD0iMyIgdmlld0JveD0iMCAwIDExIDMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPlJlY3RhbmdsZSAxMTE8L3RpdGxlPjxwYXRoIGQ9Ik0xMSAwSDB2M2gxMVYweiIgZmlsbD0iI0Q0RDRENCIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+"});
            var icon_plus = img('icon-plus', null, {title: "Expand", src: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTEiIGhlaWdodD0iMTEiIHZpZXdCb3g9IjAgMCAxMSAxMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+cGx1czwvdGl0bGU+PHBhdGggZD0iTTcgNGg0djNIN3Y0SDRWN0gwVjRoNFYwaDN2NHoiIGZpbGw9IiM5QjlCOUIiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjwvc3ZnPg=="});
            var section_els = [];

            var category_ids_names_arr = hashmap_to_array(category_ids_names);
            category_ids_names_arr.sort(function (a, b) {
                // sort categories by name, leaving "Other" in last place
                a = a[1];
                b = b[1];

                switch ("Other") {
                case a:
                    return +(a !== b);
                case b:
                    return -1;
                }

                return a.localeCompare(b, "en", {"sensitivity": "base"});
            });

            category_ids_names_arr.forEach(function (category_id_name) {
                var category_id = category_id_name[0];
                var category_name = category_id_name[1];
                var data_category_id = {"data-category-id": category_id};

                section_els.push(div('header trapit-category-header', [
                    div('title',
                        span('title-span', category_name)),
                    div('meta',
                        div('expander-collapser', [icon_plus, icon_minus])
                       )], data_category_id));


                // lookup traps by category_id from category_ids_traps
                var trap_ids = category_ids_traps[category_id];

                // sort traps in alphabetical order per category
                var temp_ids = array_flip(trap_ids);
                var temp_ids_names = array_intersect_key(trap_ids_names, temp_ids);
                var sorted_ids_names = hashmap_to_array(temp_ids_names);
                sorted_ids_names.sort(function (a, b) {
                    return a[1].localeCompare(b[1], "en", {"sensitivity": "base"});
                });

                sorted_ids_names.forEach(function (id_name) {
                    var trap_id = id_name[0];
                    var trap_name = id_name[1];
                    var other = {"data-trap-id": trap_id};
                    section_els.push(div('item primary trapit-category-trap',
                                         div('info',
                                             div('titleWrapper',
                                                 span('trap-name', trap_name))),
                                         other));
                });
            });


            var icon_all = img('icon-all icon-all-traps', null, {src: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMTkiIHZpZXdCb3g9IjAgMCAyMCAxOSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+UGF0aCArIFBhZ2UgMzwvdGl0bGU+PGcgZmlsbD0iIzAwNUI1NSIgZmlsbC1ydWxlPSJldmVub2RkIj48cGF0aCBkPSJNOCAxNkg0VjNoMTJ2M2gtNlY1SDZ2NWgydjFINnYxaDJ2MUg2djFoMnYyem0zLTEwaDNWNWgtM3YxeiIgaWQ9IlBhdGgiLz48cGF0aCBkPSJNOCAxOWgxMlY2SDh2MTN6bTItMmg4di0xaC04djF6bTAtMmg4di0xaC04djF6bTUtNGgzdi0xaC0zdjF6bTAgMmgzdi0xaC0zdjF6bTAtNGgzVjhoLTN2MXptLTUgNGg0VjhoLTR2NXoiLz48cGF0aCBkPSJNNCAxM0gwVjBoMTJ2M0g2VjJIMnY1aDJ2MUgydjFoMnYxSDJ2MWgydjJ6TTcgM2gzVjJIN3YxeiIvPjwvZz48L3N2Zz4="});
            var list = div('list', section_els);
            var app = div('app', [null, //new Nav('navbar navbar-default navbar-fixed-top'),
                                  div('wrapper',
                                      [div('sidebar-wrapper',
                                           div('sidebar traps',
                                               [div('all-traps', [icon_all,
                                                                  span(null, 'All')],
                                                    null),
                                                div('list-container', list, {id: "trapit-list-container"})
                                               ])),
                                       //new Div('notification'),
                                       div(null),
                                       // right-hand-side elements
                                       div('content traps',
                                           [div('queue',
                                                [//new Div('filter row'),
                                                    div(null),
                                                    div('body masonry trapit-body-masonry')])])])]);

            //echo '</div>'; // trapit-list-container

            var app_elements = app.getElements();
            var template = document.getElementById("trapit-template");
            // make sure this is appended to the template before being cloned into shadow root
            template.content.appendChild(app_elements);
            console.log("Appended left column.");
        });
    }


    /***
        Load the JavaScript
    ***/


    var oldWpOnload = (typeof wpOnload === 'function') ? wpOnload : null;
    wpOnload = function () {
        if (oldWpOnload) {
            oldWpOnload();
        }

        left_column_loader().then(function () {
            load_template();
            hide_sidebar_traps();

            var wpfooter = document.getElementById("wpfooter");
            //wpfooter.style.display = "none";
            wpfooter.style.visibility = "hidden";
            var wpbody_content = document.getElementById("wpbody-content");
            wpbody_content.style.paddingBottom = "0px";
            var app = TRAPIT.ROOT.querySelector(".app");
            app.style.minHeight = window.innerHeight + "px";

            // make All traps the default view
            var all_traps = app.querySelector(".all-traps");
            all_traps_click_handler();
            all_traps.classList.add("active");

            add_listeners();
        });
    };

    TRAPIT.trap_name_click_handler = trap_name_click_handler;
    TRAPIT.all_traps_click_handler = all_traps_click_handler;
    TRAPIT.trap_category_click_handler = trap_category_click_handler;
    TRAPIT.load_template = load_template;
    TRAPIT.fetch_json_then = fetch_json_then;
})();
