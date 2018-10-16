// NOTE: these global variables will be constructed in plot_it!
var x_scale, y_scale, area, baseline;
var actual_width, actual_height, map, min_x, min_y, max_x, max_y, node_map;

// data type conversions, so we are working with floats and dates
function data_type_conversion(node)  {
	if(node.children.length > 0)  {
		for(var c = 0; c < node.children.length; c++)
			data_type_conversion(node.children[c]);
		return;
	}

	var time_parser = is_music_time_series ? d3.timeParse('%Y-%m-%d') : d3.timeParse('%Y %B');
	node.counts.forEach(function(d)  {
		d.date = time_parser(d.date);
		d.count = +d.count;
	});
}

// add a 'parent' field to each node, so we can access parent data
function add_parent_links(node)  {
	for(var c = 0; c < node.children.length; c++)  {
		node.children[c].parent = node;
		add_parent_links(node.children[c]);
	}
}

// go through all nodes and collect count data
function get_all_count_data(node, all_count_data)  {
	for(var p = 0; p < node.counts.length; p++)
		all_count_data.push(node.counts[p].count);
	for(var c = 0; c < node.children.length; c++)
		get_all_count_data(node.children[c], all_count_data);
}

// create a color for each node based on the tree hierarchy (this is manually coded up: categorical colors for many categories is really tricky!)
function create_color(root_node)  {
	// black color for root
	root_node.color = d3.rgb(0,0,0);
	var hue_scale = d3.scaleLinear().domain([0,root_node.children.length-1]).range([10,250])
	for(var c = 0; c < root_node.children.length; c++)  {
		var child_node = root_node.children[c];
		var interpolator = d3.interpolateLab(d3.hsl(hue_scale(c),0.8,0.3), d3.hsl(hue_scale(c),0.8,0.8))
		child_node.color = interpolator(0.5);
		for(var d = 0; d < child_node.children.length; d++)
			child_node.children[d].color = interpolator(d / (child_node.children.length-1));
	}
}

// TODO: create a time series for each non-leaf node (`counts`) that aggregates its count data and dates - same format as `counts` in leaves
var option = true
function aggregate_counts(node)  {
    var sum, mean, temp
    if(node.children.length==0)
        return
    for(var i=0; i<node.children.length; i++)
        aggregate_counts(node.children[i])
    var len = node.children[0].counts.length
    node['counts'] = []
    for(var i=0; i<len; i++)
    {
        sum = 0.0;
        mean = 0.0;
        for(var j=0; j<node.children.length; j++)
            sum += node.children[j].counts[i].count
        mean = sum/node.children.length
        if(option == true)
            temp = mean
        else
            temp = sum
        node.counts.push({'count': temp, 'date': node.children[0].counts[i].date});
    }
}

// TODO: create/set `view_series` field to false for `node` and all of its children
function reset_node_views(node)  {
    node.view_series = false
    for(var i=0; i<node.children.length; i++)
        reset_node_views(node.children[i])
}

// TODO: traverse tree, adding nodes where `view_series` is set to true to `node_array`
function collect_viewable_nodes(node, node_array)  {
    if(node.view_series)
        node_array.push(node)
    for(var i=0; i<node.children.length; i++)
        collect_viewable_nodes(node.children[i], node_array);
}

// TODO: make `node` no longer visible, but its immediate children visible (if a child, nothing to do) - modify `view_series`!
function expand_node_view(node)  {
    if(node.children.length>0)
    {
      node.view_series = false;
      for(var i=0; i<node.children.length; i++)
        node.children[i].view_series = true;
    }
}

// TODO: make the parent of `node` visible, but the subtree rooted at `node` should not be visible (hint `reset_node_views`) (if a parent, nothing to do) - modify `view_series`!
function collapse_node_view(node)  {
    if(node.parent!=null)
    {
        node.parent.view_series = true
        for(var i=0; i<node.parent.children.length; i++)
            reset_node_views(node.parent.children[i])
    }
}

function generate_data(node_array, names) {
    var dates = []
    for(var i=0; i<node_array.length; i++)
        names.push(node_array[i].name)
    for(var i=0; i<node_array[0].counts.length; i++)
        dates.push(node_array[0].counts[i].date)
    var arr = []
    for(var i=0; i<node_array.length; i++)
        arr.push(node_array[i].counts.map(function(d){return d.count}))
    res = []
    var n_arr = d3.transpose(arr)
    for(var i=0; i<dates.length; i++)
    {
        temp = {}
        for(var j=0; j<names.length; j++)
            temp[names[j]] = n_arr[i][j]
        temp['date'] = dates[i]
        res.push(temp)
    }
    return res
}

function collect_all_node(node, node_array){
    node_array.push(node)
    for(var i=0; i<node.children.length; i++)
        collect_all_node(node.children[i], node_array);
}

function create_color_map(node_array, map)
{
    for(var i=0; i<node_array.length; i++)
        map[node_array[i].name] = node_array[i].color
}

function create_node_map(node_array, node_map)
{
    for(var i=0; i<node_array.length; i++)
        node_map[node_array[i].name] = node_array[i]
}

// TODO: does all of the visualization -> get the time series to view (`collect_viewable_nodes`), data join
function visualize_time_series(node_array, root_node)
{
    var names = []
    var data = generate_data(node_array, names)
    var stack = d3.stack()
                  .keys(names)
                  .offset(d3.stackOffsetSilhouette)
    var series = stack(data);
    
    // TODO: setting up scales: we need to compute the minimum and maximum of our count data and dates; so first, lets get our count data from all nodes, then compute min/max
    y_scale = d3.scaleLinear().range([min_y, max_y])
                .domain([d3.min(series, function(layer) {return d3.min(layer, function(d){ return d[0]})}),
                         d3.max(series, function(layer) {return d3.max(layer, function(d){ return d[1]})})])
    // TODO: remove old series
    d3.select('.linechart').selectAll('path').data([]).exit().remove()
    
    // TODO: add new series
    d3.select('.linechart').selectAll('path').data(series).enter().append('path')
         .attr('d', area)
         .style('fill', d => map[d.key])
         .attr('id', d => d.key)
    
    // TODO: text labels - remove old ones (fade them out via opacity)
    d3.select('.linechart').selectAll('text').remove()
    
    // TODO: text labels - add new ones (fade them in via opacity)
    d3.select('.linechart').selectAll('text').data(series).enter().append('text')
    .attr('x', 80+actual_width+3).attr('y', d => y_scale(d[root_node.counts.length-1][0]+(d[root_node.counts.length-1][1]-d[root_node.counts.length-1][0])/2))
    .text(d => d.key).style('fill', d => map[d.key]).attr('opacity', 1.0)
    
    // TODO: setup interactions
    d3.selectAll('path').on('click', function(d,i,g)  {
                            
        var selected_node = node_map[d.key]
                            
        if (d3.event.shiftKey)
            collapse_node_view(selected_node)
        else
            expand_node_view(selected_node)
                            
        var node_array = [];
        collect_viewable_nodes(root_node, node_array);
        visualize_time_series(node_array, root_node)
    });
}

function plot_it()  {
	// some preprocessing
	data_type_conversion(count_tree);
	add_parent_links(count_tree);
	count_tree.parent = null;
	create_color(count_tree);

	// First things first: we aggregate the time series data: non-leaf nodes should aggregate their child nodes in some sense (e.g. mean)
	aggregate_counts(count_tree);

	// Second: we initialize the nodes as to whether or not to visualize them - first, lets assume we aren't viewing any of them ...
	reset_node_views(count_tree);

	// ... and then set the root node view to be true (have to view something to start!)
	count_tree.view_series = true;

	// visualization setup: width, height, padding, actual width and height
	var width = 800, height = 800;
	var pad = 80;
	actual_width = width-2*pad;
	actual_height = height-2*pad;
	// add svg element of width x height
	var svg_elem = d3.select('body').append('svg').attr('width', width).attr('height', height);
	// add <g> transformation element to center the main plotting area by pad, assign it an id since we will be primarily selecting it
	d3.select('svg').append('g').attr('transform', 'translate('+pad+','+pad+')').attr('id', 'mainplot');
	// add <rect> element to have a nice backdrop for our plot!
	d3.select('#mainplot').append('rect').attr('width', actual_width).attr('height', actual_height).attr('fill', '#999999').attr('opacity', 0.4)

    var all_node = []
    collect_all_node(count_tree, all_node)
    
    map = new Object()
    node_map = new Object()
    create_color_map(all_node, map)
    create_node_map(all_node, node_map)
    
	// TODO: compute the x and y scales for the line plots
    min_x = pad, max_x = pad+actual_width, min_y = pad+actual_height, max_y = pad
    
	// TODO: setup the area
    area = d3.area()
        .x(d => x_scale(d.data.date))
        .y0(d => y_scale(d[0]))
        .y1(d => y_scale(d[1]))
        .curve(d3.curveBasis);
    // TODO: setup axes from the scales
    date_data = []
    for(var i = 0; i < count_tree.counts.length; i++)
        date_data.push(count_tree.counts[i].date)
    var min_node_date = d3.min(date_data, d => d), max_node_date = d3.max(date_data, d => d)
    x_scale = d3.scaleTime().domain([min_node_date,max_node_date]).range([min_x, max_x])
    svg_elem.append('g').attr('transform', 'translate(0,'+min_y+')').call(d3.axisBottom(x_scale))
    
    var group = d3.select('svg').append('g').attr('class', 'linechart')
    // visualize data!
    var node_array = [];
    collect_viewable_nodes(count_tree, node_array);
    
	visualize_time_series(node_array, count_tree)
}
