/**
 * Query the API for information about a certian address.
 * 
 * @param {String} [address] - The wallet address to be queried.
 * @param {String} [key] - NOWNodes API key
 * @returns {Object} Details about the address, including transactions.
 */
async function get_address(address, key) {
    //Create headers for API call
    var headers = new Headers();
    headers.append("api-key", key);
    var requestOptions = {
        method: 'GET',
        headers: headers,
        redirect: 'follow'
      };
    //Query the API
    const response = await fetch(`https://btcbook.nownodes.io/api/v2/address/${address}`, requestOptions);
    //Bad responses
    switch(response.status){
        case 200:
            break;
        case 400:
            throw new Error("Oops! Address provided is not a Bitcoin wallet.");
        case 401:
            throw new Error("Oops! Your API Key didn't work.");
        default:
            throw new Error(response);
    }
    //Parse data into Object
    const text = await response.text();
    var json = JSON.parse(text);
    return json;
}


/**
 * Query the API for information about a certian transaction.
 * 
 * @param {String} [txid] - The transaction to be queried.
 * @param {String} [key] - NOWNodes API key
 * @returns {Object} Details about the address, including transactions.
 */
async function get_transaction(txid, key) {
    //Create headers for API call
    var headers = new Headers();
    headers.append("api-key", key);
    var requestOptions = {
        method: 'GET',
        headers: headers,
        redirect: 'follow'
      };
    //Query the API
    const response = await fetch(`https://btcbook.nownodes.io/api/v2/tx/${txid}`, requestOptions);
    //Parse data into Object
    const text = await response.text();
    const json = JSON.parse(text);
    return json;
}


/**
 * Find the destination of transaction. (where most of the money goes)
 * 
 * @param {String} [tx] - The transaction object.
 * @returns {Object} Details about the address, including transactions.
 */
function find_destination(tx) {
    const value = parseInt(tx['value']);
    var vout = tx['vout'];
    var result = [];
    var diff = Infinity;
    for (let out of vout) {
        var d = Math.abs(value - parseInt(out['value']));
        if (d < diff) {
            diff = d;
            result = out['addresses'];
        }
    }
    return result[0];
}

/**
 * Create a set of Verticies and Edges, up to depth steps away from orgin.
 * 
 * @param {String} [key] - API Key for NOWNodes.
 * @param {String} [orgin_address] - The wallet address under scruitiny.
 * @param {Number} [depth] - Maximum steps aay from orgin.
 * @param {Status} [status] - Object that controls view of site
 * @returns {Object} Contains entire graph.
 */
async function generate_graph(key, orgin_address, depth, status) {
    status.show_loading();
    var current_queue = [orgin_address];
    // Objects to store information, represents graph. Each key in a vertex, outgoing edges are stored.
    var graph = {};
    for (let i = 0; i < depth; i++) {
        var next_queue = [];
        //Empty the current queue
        for (const address of current_queue) {
            // If we have already seen this vertex, skip over it.
            if (address in graph) {
                continue;
            }
            //Update status with what is happening
            status.load_msg(`<i class="bi bi-wallet2"></i> ${address}`);
            //Get the information about this address, Add vertex to graph
            graph[address] = await get_address(address, key);
            //Dont bother looking at outer vertecies transactions
            if (i + 1 === depth) {
                graph[address]["transactions"] = [];
                continue;
            }
            //Add the outgoing transactions from this vertex
            var tranaction_list = [];
            var explore_tx = graph[address]['txids'].slice(0, 10);
            for (var txid of explore_tx) {
                //Update status with what is happening
                status.load_msg(`<i class="bi bi-arrow-down-up"></i> ${txid}`);
                transaction = await get_transaction(txid, key);
                var dest = find_destination(transaction);
                transaction['destination'] = dest;
                tranaction_list.push(transaction);
                //Find and add the destination to the next queue
                next_queue.push(dest);
            }
            //Save transactions
            graph[address]["transactions"] = tranaction_list;
        }
        //Set to next queue for next iteration
        current_queue = next_queue;
    }
    return graph;
}


/**
 * Translate information into visual HTML elements.
 * 
 * @param {Object} [information] - The information to be made visual.
 * @param {Status} [status] - Object that controls view of site
 */
function draw_graph(information, status){
    //Create nodes and links of graph, index them.
    var nodes = [];
    var nodex = [];
    var links = [];
    var linkdex = [];
    //Also log information to console
    console.log(information);
    //k is the wallet ID, v is the information queried by API
    for (const [k, v] of Object.entries(information)) {
        nodes.push({id: k, x: 0, y: 0, info: v});
        //Index wallet ID
        nodex.push(k);
    }
    //k is the wallet ID, v is the information queried by API
    for (const [k, v] of Object.entries(information)) {
        //Iterate over the tranactions of this node
        for (const tx of v['transactions']) {
            //Dont care about reflexive transactions - also, this would break the visual (not functionally, but lots of errors in console).
            if (tx['destination'] === k) {
                continue;
            }
            //Find index of node
            var tg = nodex.indexOf(tx['destination']);
            //If there exists transaction between node and dest, it will be in lindex as either source||dest or dest||source
            var ldx1 = linkdex.indexOf(k.concat(tx['destination']));
            var ldx2 =linkdex.indexOf(tx['destination'].concat(k));
            //There is a transaction between the two
            if (ldx1 != -1 || ldx2 != -1) {
                var ldx = Math.max(ldx1, ldx2);
                // and add the new information
                links[ldx].info.push(tx);
                links[ldx].bi = links[ldx].bi ? true: ldx === ldx1 ? true : false;
                continue;
            }
            //The destination is already on graph, add a link.
            if (tg != -1) {
                links.push({source: nodes[nodex.indexOf(k)], target: nodes[tg], info: [tx], dist: 75, bi: false});
                //add transaction to linkdex
                linkdex.push(tx['destination'].concat(k));
            }
        }
    }
    //Create Visual Graph   
    setGraph(nodes, links);

    //Show the user the visual graph
    status.show_svg();
}

//The Status Object controls what is displayed on screen
class Status {
    constructor() {
        //Get the elements we are controlling visability on
        this.loader = document.getElementById("loader");
        this.error = document.getElementById("error");
        this.loading_txt = document.getElementById("loading-msg");
        this.error_txt = document.getElementById("error-msg");
        this.svg = document.getElementById("svg");
        this.instructions = document.getElementById("instructions");
        //Toggle info is a bootstrap element, has a class that we can utilize, so we will modify the classlist instead.
        this.toggle_info = document.getElementById("toggle-info");
    }

    //Only display the loading element
    show_loading() {
        this.loader.removeAttribute("hidden");
        this.svg.setAttribute("hidden", "1");
        this.instructions.setAttribute("hidden", "1");
        this.error.setAttribute("hidden", "1");
        this.toggle_info.classList.remove("show");
    }

    //Modify what the loading element says
    load_msg(html) {
        this.loading_txt.innerHTML = html;
    }

    //Only show the instructions (landing page)
    show_instructions() {
        this.instructions.removeAttribute("hidden");
        this.svg.setAttribute("hidden", "1");
        this.loader.setAttribute("hidden", "1");
        this.error.setAttribute("hidden", "1");
        this.toggle_info.classList.remove("show");
    }

    //Only show the graph (and info as it pertains to graph)
    show_svg() {
        this.svg.removeAttribute("hidden");
        this.loader.setAttribute("hidden", "1");
        this.instructions.setAttribute("hidden", "1");
        this.error.setAttribute("hidden", "1");
        this.toggle_info.classList.add("show");
    }

    //Only show the error screen, for 3 seconds, with the error message. Then, return to landing page.
    async show_error(e) {
        this.error.removeAttribute("hidden");
        this.loader.setAttribute("hidden", "1");
        this.instructions.setAttribute("hidden", "1");
        this.svg.setAttribute("hidden", "1");
        this.toggle_info.classList.remove("show");
        //display for 3 seconds
        for (let i = 3; i >= 0; i--) {
            this.error_txt.innerText = `(${i}) ${e}`;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        //return to instruction page
        this.show_instructions();
    }
}


/**
 * Initialize the WebApp - enable tooltips, set up renderJSON, control object for document, event listeners.
 */
function init() {
    // Enable ToolTips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

    //Set up renderJSON
    renderjson.set_icons('►', '▼');
    renderjson.set_show_to_level(1);
    
    //create Loading object that handles loading messages
    var status = new Status();
    status.show_instructions();

    //Get inputs and buttons essential to functionality
    var key_input = document.getElementById("api_key");
    var wallet_input = document.getElementById("target_address");
    var depth_input = document.getElementById("depth");
    var submit_button = document.getElementById("create-graph");
    var export_button = document.getElementById("export");

    //Other elements to modify
    let spinner = document.getElementById('run-spinner');
    let icon = document.getElementById('run-icon');

    //the current information being displayed
    var information;

    function toggleRun() {
        submit_button.toggleAttribute("disabled");
        icon.toggleAttribute('hidden');
        spinner.toggleAttribute('hidden');
    }

    //Listen for click on generate button
    submit_button.addEventListener("click", async function (e) {
        // Get parameter values
        let depth = depth_input.value;
        let orgin = wallet_input.value;
        let key = key_input.value;
        //Disable Run button
        toggleRun();
        // Check if parameters are filled
        if (!depth || !orgin || !key) {
            //Show the error, Re-enable run button
            await status.show_error("Oops! Missing parameter(s). Make sure to set API Key, BTC Address and Depth!");
            toggleRun();
            return;
        }
        // Warn user about losing unsaved data
        if (information) {
            if (!window.confirm("Running will reset the graph. Are you sure?")) return;
        }
        //Generate graph information, generate_graph throws errors based on response codes from API
        try {
            information = await generate_graph(key, orgin, parseInt(depth), status);
        }
        catch(e) {
            //Display the error, Re-enable run button
            await status.show_error(e);
            toggleRun();
            return;
        }
        //Re-enable run button
        toggleRun();
        //Draw the graph
        draw_graph(information, status);
        //Enlarge starting node
        document.getElementById(orgin).setAttribute('r', 20);
    });
    //Listen for click on export button
    export_button.addEventListener("click", async (e) => {
        //Error if there is no information to save.
        if (!information) {
            await status.show_error("There is no information to save. Run a search first!");
            return;
        }
        else {
            //Create and download JSON Object trick
            var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(information));
            var downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `track_${wallet_input.value}.json`);
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }
    });
}

//initalize document
init();


function setGraph(nodes, links) {
    // Clear out contents of the svg element
    document.getElementById('svg').innerHTML = "";

    //Calculate the area it covers - we want with to be 70% of the screen as the information aside is 30%
    var width = document.getElementById('svg').parentElement.clientWidth  * 7 / 10;
    var height = document.getElementById('svg').parentElement.clientHeight;

    //init svg element for D3
    var svg = d3.select('#svg').append('svg').attr('oncontextmenu', 'return false;').attr('width', width).attr('height', height);

    // init D3 force layout
    var force = d3.layout.force().nodes(nodes).links(links).size([width, height]).charge(-200).on('tick', tick).linkDistance(function(d) {
        return d.dist;
    });

    // define arrow markers for graph links
    svg.append('svg:defs').append('svg:marker').attr('id', 'end-arrow').attr('viewBox', '0 -5 10 10').attr('refX', 6).attr('markerWidth', 3).attr('markerHeight', 3).attr('orient', 'auto').append('svg:path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#000');
    svg.append('svg:defs').append('svg:marker').attr('id', 'start-arrow').attr('viewBox', '0 -5 10 10').attr('refX', 4).attr('markerWidth', 3).attr('markerHeight', 3).attr('orient', 'auto').append('svg:path').attr('d', 'M10,-5L0,0L10,5').attr('fill', '#000');

    // handles to link and node element groups
    var path = svg.append('svg:g').selectAll('path');
    var circle = svg.append('svg:g').selectAll('g');


    // mouse event vars
    var selected_node = null;
    var selected_link = null;
    var mousedown_link = null;
    var mousedown_node = null;

    // update force layout (called automatically each iteration)
    function tick() {
        // draw directed edges with proper padding from node centers
        path.attr('d', function(d) {
            var deltaX = d.target.x - d.source.x,
            deltaY = d.target.y - d.source.y,
            dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
            normX = deltaX / dist,
            normY = deltaY / dist,
            sourcePadding = 12,
            targetPadding = 17,
            sourceX = d.source.x + (sourcePadding * normX),
            sourceY = d.source.y + (sourcePadding * normY),
            targetX = d.target.x - (targetPadding * normX),
            targetY = d.target.y - (targetPadding * normY);
            return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
        });
        //Move the circles each tick, bounded by sice of parenet element
        circle.attr('transform', function(d) {
            return `translate(${Math.max(12, Math.min(width - 12, d.x))},${Math.max(12, Math.min(height - 12, d.y))})`;
        });
    }

    // update graph
    function restart() {
        // path (link) group
        path = path.data(links);

        // update existing links
        path.classed('selected', function(d) {
            return d === selected_link;
        }).style('marker-start', function(d) {
            return d.bi ? 'url(#start-arrow)': '';
        }).style('marker-end', 'url(#end-arrow)');

        // add new links
        path.enter().append('svg:path').attr('class', 'link').style('marker-start', function(d) {
            return d.bi ? 'url(#start-arrow)': '';
        }).style('marker-end', 'url(#end-arrow)')
        .classed('selected', function(d) {
            return d === selected_link;
        }).on('mousedown', function(d) {
            if (d3.event.ctrlKey) return;
            // select link
            mousedown_link = d;
            if (mousedown_link === selected_link) selected_link = null;
            else selected_link = mousedown_link;
            selected_node = null;
            //Update the aside to reflect the information in the selected link
            var off_title = document.getElementById("off-title");
            var off_info = document.getElementById("off-info");
            //Title element of aside
            off_title.innerHTML = `<i class="bi bi-wallet2"></i> ${d.source.id}<br><i class="bi bi-arrow-down-up"></i><br><i class="bi bi-wallet2"></i> ${d.target.id}`;
            //Reset the inner HTML of the aside body
            off_info.innerHTML = "";
            if (d.info.length > 1) {
                console.log()
            }
            //There may be multiple information objects, append them all
            for (const item of d.info) {
                off_info.appendChild(renderjson(item));
            }
            //Update the graph to reflect selection
            restart();
        });

        // circle (node) group - known by ID!
        circle = circle.data(nodes, function(d) {
            return d.id;
        });

        //Function for calculating the h value for HSL (bad attempt at heatmap lol)
        function get_hval(d) {
            var hval = 260 - (5 * Math.floor(Math.sqrt(d.info.txs + 10000) + 0.5 - Math.sqrt(10000)));
            hval = hval < 0 ? 360 : hval;
            //If this is the currently selected node, brighten it
            return (d === selected_node) ? `hsl(${hval}, 100%, 75%)`:`hsl(${hval}, 100%, 50%)`;
        }

        // update existing nodes
        circle.selectAll('circle').style('fill', function(d) {            
            return get_hval(d);
        });

        // add new nodes
        var g = circle.enter().append('svg:g');
        g.append('svg:circle').style('stroke', "#000").attr('class', 'node').attr('r', 12).attr('id', function(d) {
            return d.id;
        }).style('fill', function(d) {
            return get_hval(d);
        }).on('mousedown', function(d) {
            // select node
            mousedown_node = d;
            if (mousedown_node === selected_node) selected_node = null;
            else selected_node = mousedown_node;
            selected_link = null;
            //Update the aside to reflect the information in the selected node
            var off_title = document.getElementById("off-title");
            var off_info = document.getElementById("off-info");
            off_title.innerHTML = `<i class="bi bi-wallet2"></i> ${d.id}`;
            off_info.innerHTML = "";
            off_info.appendChild(renderjson(d.info));
            //Update the graph to reflect selection
            restart();
        });
        // set the graph in motion, allow users to drag nodes
        circle.call(force.drag);
        force.start();
    }
    //Start the graph
    restart();   
}