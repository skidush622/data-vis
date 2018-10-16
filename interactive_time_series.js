s// NOTE: these global variables will be constructed in plot_it!
var x_scale, y_scale, line_scale;
var actual_width, actual_height;

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

// TODO: does all of the visualization -> get the time series to view (`collect_viewable_nodes`), data join, setup interactions
function visualize_time_series(root_node, is_collapsing, selected_node)  {
    if(!selected_node)
    {
      var node_array = [];
      collect_viewable_nodes(root_node, node_array);
    
    // TODO: data join for line plot
      d3.select('.linechart').selectAll('path').data(node_array).enter().append('path')
        .attr('d', d => line_scale(d.counts))
        .attr('stroke', d => d.color)
        .attr('fill', 'none')
        .attr('stroke-width', '5')
        .attr('id', d => d.name)
    
    // TODO: data join for text
      d3.select('.linechart').selectAll('text').data(node_array).enter().append('text')
        .attr('x', 80+actual_width+3).attr('y', d => y_scale(d.counts.slice(-1)[0].count))
        .text(d => d.name).style('fill', d => d.color).attr('opacity', 1.0)
    }
    else
    {
      var vanilla_transition = d3.transition().duration(1000);
      if(is_collapsing)
          collapse_node_view(selected_node)
      else
          expand_node_view(selected_node)
      node_array = [];
      collect_viewable_nodes(root_node, node_array);
      
      if(is_collapsing)
      {
          // TODO: remove old series
          new_node_array = []
          for(var k=0; k<node_array.length; k++)
          {
              if(node_array[k]!=selected_node.parent)
                  new_node_array.push(node_array[k])
          }
          d3.select('.linechart').selectAll('path').data(new_node_array).exit()
           .transition(vanilla_transition)  
           .attr('d', line_scale(selected_node.parent.counts))
           .attr('stroke', selected_node.parent.color)
           .remove()
          // TODO: add new series
          d3.select('.linechart').selectAll('aaa').data([selected_node.parent]).enter().append('path')
           .attr('d', d => line_scale(d.counts))
           .attr('stroke', d => d.color)
           .attr('fill', 'none')
           .attr('stroke-width', '5')
           .attr('id', d => d.name)
      }else{
          // TODO: remove old series
          d3.select('#'+selected_node.name).remove()
          // TODO: add new series
          d3.select('.linechart').selectAll('bbb').data(selected_node.children).enter().append('path')
          .attr('d', line_scale(selected_node.counts))
          .transition(vanilla_transition)
          .attr('d', d => line_scale(d.counts))
          .attr('stroke', d => d.color)
          .attr('fill', 'none')
          .attr('stroke-width', '5')
          .attr('id', d => d.name)
          .attr('class', selected_node.name)
      }
    // TODO: text labels - remove old ones (fade them out via opacity)
      d3.select('.linechart').selectAll('text').attr('opacity', 0.0).remove()
    // TODO: text labels - add new ones (fade them in via opacity)
      d3.select('.linechart').selectAll('text').data(node_array).enter().append('text')
        .attr('x', 80+actual_width+3).attr('y', d => y_scale(d.counts.slice(-1)[0].count))
        .text(d => d.name).style('fill', d => d.color).attr('opacity', 0.0)
      d3.selectAll('text').transition(vanilla_transition).attr('opacity', 1.0)
    }
    
	// TODO: setup interactions
    d3.selectAll('path').on('click', function(d,i,g)  {
        if (d3.event.shiftKey) {
            visualize_time_series(root_node, true, d)
        }else{
            visualize_time_series(root_node, false, d)}
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

	// TODO: setting up scales: we need to compute the minimum and maximum of our count data and dates; so first, lets get our count data from all nodes, then compute min/max
    count_data = []
    get_all_count_data(count_tree, count_data)
    var min_node_count = d3.min(count_data, d => d), max_node_count = d3.max(count_data, d => d)

	// TODO: for the min/max of dates, they are equivalent across nodes, so just map the root node's dates to an array, compute min and max
    date_data = []
    for(var i = 0; i < count_tree.counts.length; i++)
        date_data.push(count_tree.counts[i].date)
    var min_node_date = d3.min(date_data, d => d), max_node_date = d3.max(date_data, d => d)
    
	// TODO: compute the x and y scales for the line plots
    var min_x = pad, max_x = pad+actual_width, min_y = pad+actual_height, max_y = pad
    x_scale = d3.scaleTime().domain([min_node_date,max_node_date]).range([min_x, max_x])
    y_scale = d3.scaleLinear().domain([min_node_count,max_node_count]).range([min_y, max_y])
    
	// TODO: setup the line scale
    line_scale = d3.line()
        .x(d => x_scale(d.date))
        .y(d => y_scale(d.count))
    
	// TODO: setup axes from the scales
    svg_elem.append('g').attr('transform', 'translate('+min_x+',0)').call(d3.axisLeft(y_scale))
    svg_elem.append('g').attr('transform', 'translate(0,'+min_y+')').call(d3.axisBottom(x_scale))
        
    var group = d3.select('svg').append('g').attr('class', 'linechart')
	// visualize data!
	visualize_time_series(count_tree, false);
}
