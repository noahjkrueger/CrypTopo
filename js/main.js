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
    const text = await response.text();
    var json = JSON.parse(text);
    //Return the data
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
    const text = await response.text();
    const json = JSON.parse(text);
    //Return the data
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
    if (information === {}) {
        return;
    }
    //create nodes and links of graph
    var nodes = [];
    var nodex = [];
    var links = [];
    var linkdex = [];
    console.log(information);
    for (const [k, v] of Object.entries(information)) {
        nodes.push({id: k, x: 0, y: 0, info: v});
        nodex.push(k);
    }
    for (const [k, v] of Object.entries(information)) {
        for (const tx of v['transactions']) {
            if (tx['destination'] === k) {
                continue;
            }
            var tg = nodex.indexOf(tx['destination']);
            var ldx = linkdex.indexOf(k.concat(tx['destination']));
            ldx = ldx === -1 ? linkdex.indexOf(tx['destination'].concat(k)) : -1;
            if (ldx != -1) {
                var new_info = links[ldx]["info"];
                links[ldx]["info"] = [];
                new_info.push(tx);
                links.push({source: nodes[tg], target: nodes[nodex.indexOf(k)], info: new_info});
                continue;
            }
            if (tg != -1) {
                links.push({source: nodes[nodex.indexOf(k)], target: nodes[tg], info: [tx]});
                linkdex.push(tx['destination'].concat(k));
            }
        }
    }
    //Create Visual Graph   
    setGraph(nodes, links);

    //Show the user the visual graph
    status.show_svg();
}

//Create Loading object to handle loading events
class Status {
    constructor() {
        this.loader = document.getElementById("loader");
        this.error = document.getElementById("error");
        this.loading_txt = document.getElementById("loading-msg");
        this.error_txt = document.getElementById("error-msg");
        this.svg = document.getElementById("svg");
        this.instructions = document.getElementById("instructions");
    }

    show_loading() {
        //hide all but loading element
        this.loader.removeAttribute("hidden");
        this.svg.setAttribute("hidden", "1");
        this.instructions.setAttribute("hidden", "1");
        this.error.setAttribute("hidden", "1");
        document.getElementById("toggle-info").classList.remove("show");
    }

    load_msg(html) {
        this.loading_txt.innerHTML = html;
    }

    show_instructions() {
        //hide all but instruction element
        this.instructions.removeAttribute("hidden");
        this.svg.setAttribute("hidden", "1");
        this.loader.setAttribute("hidden", "1");
        this.error.setAttribute("hidden", "1");
        document.getElementById("toggle-info").classList.remove("show");
    }

    show_svg() {
        //hide all but info and svg elements
        this.svg.removeAttribute("hidden");
        this.loader.setAttribute("hidden", "1");
        this.instructions.setAttribute("hidden", "1");
        this.error.setAttribute("hidden", "1");
        document.getElementById("toggle-info").classList.add("show");
        var off_title = document.getElementById("off-title");
        var off_info = document.getElementById("off-info");
        off_title.innerHTML = `<i class="bi bi-mouse"></i> Select Node or Edge`;
        off_info.innerHTML = `<i class="bi bi-info-circle"></i> Click for details<br><br><i class="bi bi-info-circle"></i> Click`
                                + ` + Drag to move Nodes<br><br><i class="bi bi-info-circle"></i> This section is scrollable`;
    }

    async show_error(e) {
        //hide all but error element
        this.error.removeAttribute("hidden");
        this.loader.setAttribute("hidden", "1");
        this.instructions.setAttribute("hidden", "1");
        this.svg.setAttribute("hidden", "1");
        document.getElementById("toggle-info").classList.remove("show");
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
 * Initialize the WebApp
 */
function init() {
    // Enable ToolTips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

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

    //the current information being displayed
    var information;

    function toggleRun() {
        submit_button.toggleAttribute("disabled");
        let spinner = document.getElementById('run-spinner');
        let icon = document.getElementById('run-icon');
        icon.toggleAttribute('hidden');
        spinner.toggleAttribute('hidden');
    }

    //Add event listeners
    //Listen for click on generate button
    submit_button.addEventListener("click", async function (e) {
        let depth = depth_input.value;
        let orgin = wallet_input.value;
        let key = key_input.value;
        toggleRun();
        if (!depth || !orgin || !key) {
            await status.show_error("Oops! Missing parameter(s). Make sure to set API Key, BTC Address and Depth!");
            toggleRun();
            return;
        }
        if (information) {
            const response = window.confirm("Running will reset the graph. Are you sure?");
            if (!response) return;
        }
        try {
            information = await generate_graph(key, orgin, parseInt(depth), status);
        }
        catch(e) {
            await status.show_error(e);
            toggleRun();
            return;
        }
        toggleRun();
        draw_graph(information, status);
        document.getElementById(orgin).setAttribute('r', 20);
    });
    //Listen for click on export button
    export_button.addEventListener("click", e => {
        if (!information) {
            window.alert("Oops! Nothing to export. Run a search first!");
            return;
        }
        else {
            //Create and download JSON Obj trick
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
    document.getElementById('svg').innerHTML = "";
    // set up SVG for D3
    var width = document.getElementById('svg').parentElement.clientWidth  * 7 / 10;
    var height = document.getElementById('svg').parentElement.clientHeight;
    var colors = d3.scale.category20();

    var svg = d3.select('#svg').append('svg').attr('oncontextmenu', 'return false;').attr('width', width).attr('height', height);

    // init D3 force layout
    var force = d3.layout.force().nodes(nodes).links(links).size([width, height]).linkDistance(75).charge(-200).on('tick', tick);

    // define arrow markers for graph links
    svg.append('svg:defs').append('svg:marker').attr('id', 'end-arrow').attr('viewBox', '0 -5 10 10').attr('refX', 6).attr('markerWidth', 3).attr('markerHeight', 3).attr('orient', 'auto').append('svg:path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#000');

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
        circle.attr('transform', function(d) {
            return `translate(${Math.max(12, Math.min(width - 12, d.x))},${Math.max(12, Math.min(height - 12, d.y))})`;
        });
    }

    // update graph (called when needed)
    function restart() {
        // path (link) group
        path = path.data(links);

        // update existing links
        path.classed('selected', function(d) {
            return d === selected_link;
        }).style('marker-end', function() {
            return 'url(#end-arrow)';
        });

        // add new links
        path.enter().append('svg:path').attr('class', 'link').style('marker-end', 'url(#end-arrow)').classed('selected', function(d) {
            return d === selected_link;
        }).on('mousedown', function(d) {
            if (d3.event.ctrlKey) return;
            // select link
            mousedown_link = d;
            if (mousedown_link === selected_link) selected_link = null;
            else selected_link = mousedown_link;
            selected_node = null;
            var off_title = document.getElementById("off-title");
            var off_info = document.getElementById("off-info");
            off_title.innerHTML = `<i class="bi bi-wallet2"></i> ${d.source.id}<br><i class="bi bi-arrow-down-up"></i><br><i class="bi bi-wallet2"></i> ${d.target.id}`;
            off_info.innerHTML = "";
            for (const item of d.info) {
                off_info.appendChild(renderjson(item));
            }
            restart();
        });

        // circle (node) group
        circle = circle.data(nodes, function(d) {
            return d.id;
        });

        // update existing nodes
        circle.selectAll('circle').style('fill', function(d) {
            var num = 260 - (10 * Math.floor(0.5 + Math.sqrt(d.info.txs)));
            while (num < 0) {
                num += 360;
            }
            return (d === selected_node) ? `hsl(${num}, 100%, 75%)`:`hsl(${num}, 100%, 50%)`;
        });

        // add new nodes
        var g = circle.enter().append('svg:g');
        g.append('svg:circle').style('stroke', "#000").attr('class', 'node').attr('r', 12).attr('id', function(d) {
            return d.id;
        }).style('fill', function(d) {
            var num = 260 - (10 * Math.floor(0.5 + Math.sqrt(d.info.txs)));
            while (num < 0) {
                num += 360;
            }
            return (d === selected_node) ? `hsl(${num}, 100%, 75%)`:`hsl(${num}, 100%, 50%)`;
        }).on('mousedown', function(d) {
            if (d3.event.ctrlKey) {
                return;
            }
            // select node
            mousedown_node = d;
            if (mousedown_node === selected_node) selected_node = null;
            else selected_node = mousedown_node;
            selected_link = null;
            var off_title = document.getElementById("off-title");
            var off_info = document.getElementById("off-info");
            off_title.innerHTML = `<i class="bi bi-wallet2"></i> ${d.id}`;
            off_info.innerHTML = "";
            off_info.appendChild(renderjson(d.info));
            restart();
        });
        // set the graph in motion
        circle.call(force.drag);
        force.start();
    }

    d3.select(window).on('resize', function() {
        svg.attr("width", document.getElementById('svg').offsetWidth);
        svg.attr("height", document.getElementById('svg').offsetHeight);
    });

    restart();   
}