$(document).ready(function(){

	//cache selector. whynot? (I prefix jquery objects with $ so I remember not to recast them - for speed)
	$instagrams = $('#instagrams')


	//call plugin with options
	var m = $instagrams.multigram({
		  clientID: "fc89951c3b18466eb528c4ac4584d707"
	});
	/*
	//or pass users as object
	$instagrams.multigram({
		  users: [
		  	{username: "kilokeith", token: "fc89951c3b18466eb528c4ac4584d707"}
		  ],
		  hashtags: ['hipster']
	});
	*/


	//implement reactions to plugin events
	$instagrams.on('multigram.searches_complete', function(e){
		$('#load-more-btn').removeClass('loading');
	});


	//see instagram objects at http://instagram.com/developer/endpoints/media/#get_media_search
	$instagrams.on('multigram.add_image', function(e, instagram_object){
		var $insta = $('<div/>', {
			  'class': 'instagram'
			, 'data-full': instagram_object.images.standard_resolution
		}).css('background-image', 'url('+instagram_object.images.thumbnail.url+')');
		//add to DOM
		$instagrams.append($insta);
	});

	
	//debugging
	$instagrams.on('multigram.error', function(e, message, user, error){
		console.error(message, user, error);
	});



	//load older instagrams
	$('#load-more-btn').on('click', function(){
		$(this).addClass('loading');
		//call a method in the plugin
		$instagrams.data('plugin_multigram').loadMore();
	});





	/* TESTING ALL EVENTS */
	$instagrams
	.on('multigram.init', function(e){
		console.info('multigram.init');
	})
	.on('multigram.loaded_more', function(e){
		console.info('multigram.loaded_more');
	})
	.on('multigram.reset', function(e){
		console.info('multigram.reset');
	})
	.on('multigram.search', function(e, result_set){
		console.info('multigram.search', result_set);
	})
	.on('multigram.searches_complete', function(e, result_set){
		console.info('multigram.searches_complete', result_set);
	})
	.on('multigram.user_lookup', function(e, user){
		console.info('multigram.user_lookup', user);
	})
	.on('multigram.user_lookups_complete', function(e, user){
		console.info('multigram.user_lookup', user);
	});
});