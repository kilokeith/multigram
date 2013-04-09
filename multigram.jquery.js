//requires jQuery >= 1.5
//requires aysc.js (https://raw.github.com/caolan/async/master/lib/async.js)
//requires underscore.js (http://underscorejs.org/underscore-min.js)


//Events to emit back to main element. event - (event, [args...])
/*
multigram.init - (e)
multigram.user_lookup - (e, user)
multigram.user_lookups_complete - (e)
multigram.search - (e, result_set)
multigram.searches_complete - (e, result_set)
multigram.instagrams_filtered - (e, result_set)
multigram.add_image - (e, instagram_object)
multigram.loaded_more - (e, page)
multigram.reset - (e)
multigram.error - (e, message, user, error)
*/

//make an isolated jquery plugin
;(function ($, window, document, undefined) {
	// Create the defaults once
	var pluginName = 'multigram';
	//defaults
	var defaults = {
		  clientID: ''
		, accessToken: ''
		, autoStart: true
		, numImagesPerUserPerLoad: 10
		, totalImagePerLoad: null
		, instagramSearchURL: 'https://api.instagram.com/v1/users/{userID}/media/recent'
		, instagramSearchUserURL: 'https://api.instagram.com/v1/users/search'
	};



	// The actual plugin constructor
	function MultiGram(element, options) {
		//
		this.element = element;
		this.$elm = $(element);

		this.options = $.extend({}, defaults, options);
		this._defaults = defaults;
		this._name = pluginName;

		//init vars
		this.hashtags = [];
		this.hashtag_match = null;
		this.users = this.options.users || [];


		//pages we've gone through
		this.page = 0;

		//call initializer
		this.init();

		return this;
	}

	//add plugin methods
	MultiGram.prototype = {
		// first thing called. initializes plugin
		init: function () {
			var _this = this;

			//if not passed in options,
			//get the data attributes
			if(_this.hashtags.length == 0){
				this.parseDataAttribute('hashtags', 'hashtags');
			}
			if(_this.users.length == 0){
				this.getUserNamesAndTokens();
			}

			//make a regex to match hastags
			if(_this.hashtags.length > 0){
				_this.hashtag_match = new RegExp('\\b' + _this.hashtags.join('\\b|\\b') + '\\b', 'gi');
			}

			//prefetch the user ids
			var getUserIDs = this.prefetchUserIDs();

			//once all of the user are fetched, then we can init
			getUserIDs.done(function(){


				//should probably start loading on start, but allow user not to
				if( _this.options.autoStart ){
					_this.queueSearches();
				}


				//trigger init event
				_this.$elm.trigger('multigram.init');	
			});
			
		},
		





		//turns data attributes like "moo, foo ,    bar" into ["moo", "foo", "bar"]
		parseDataAttribute: function (attr, thisvar) {
			var d = this.$elm.data(attr);
			if(d && d != ''){
				var splits = d.split(/[\s,]+/);
				this[thisvar] = splits || [];
			}
		},

		//parse data attributes to user names/id and tokens
		getUserNamesAndTokens: function () {
			var datas = this.$elm.data();
			//
			for (var key in datas) {
				//try to match a data-user
				var matches = key.match(/^user_([\w-_]+)$/);
				//skip if no match	
				if(!matches || matches.length == 0) continue;
				
				var username = matches[1].toLowerCase() || null;
				if(username){
					var user = {token: datas[key]};
					if(!isNaN(parseFloat(username)) && isFinite(username)){
						user.id = username;
					}else{
						user.username = username;
					}
					this.users.push(user);
				}
			}
		},





		prefetchUserIDs: function () {
			var _this = this;
			var promise = new $.Deferred();

			//to do to each user
			var iterator = function (user, next) {
				if( typeof user.id != 'undefined' ){
					//already has id, so resolve immediately
					next(null, user);
				}else{
					//get the user data back, then call next in stack
					_this.getUserId(user.username, function(error, userdata){
						//store user object now
						user.id = userdata.id;
						//call next in line
						next(error, user);
					});
				}
			};

			//to do once all searches are complete
			var callback = function (err) {
				//trigger user lookup completed
				_this.$elm.trigger('multigram.user_lookups_complete', _this.users);
				//resolve our promise to fetch users
				promise.resolve();
			};

			//lookup user ids
			async.each(this.users, iterator, callback);

			return promise;
		},

		getUserId: function (username, callback) {
			var _this = this;

			var qs = {
				  client_id:  _this.options.clientID
				, q: username
			};
			//swap in userid
			var searchURL = _this.options.instagramSearchUserURL + "?callback=?";

			var search = $.ajax({
				  url: searchURL
				, data: qs
				, dataType: 'jsonp'
			});

			search.done(function (res) {
				if( res && res.meta.code == 200 && res.data.length > 0 ){
					//trigger error
					_this.$elm.trigger('multigram.user_lookup', res.data[0]);
					callback(null, res.data[0]);
				}else{
					//trigger error
					_this.$elm.trigger('multigram.error', 'user lookup failed', username, res.meta);
					callback('user lookup failed');
				}
			});
		},





		//queues up searches
		queueSearches: function () {
			var _this = this;
			
			var filtered_instagrams = [];

			//to do on each user
			var iterator = function (user, next) {
				_this.searchInstagram(user, function(err, instagrams){
					//skiip if error
					if(err || !instagrams || instagrams.length == 0){
						return next(err||'No instagrams found');
					}

					//if no hashtags set, return all instagrames
					if( _this.hashtags.length == 0 || !_this.hashtag_match){
						console.log('HERE', _this.hashtag_match, _this.hashtags);
						filtered_instagrams = instagrams;
					}else{
						filtered_instagrams = _this.filterInstagrams(instagrams);
					}
					
					//trigger event that filtering is done
					_this.$elm.trigger('multigram.instagrams_filtered', filtered_instagrams);
					
					//
					if(filtered_instagrams.length > 0){
						_this.addImages(filtered_instagrams, next);
					}else{
						next(err);
					}

				});
			};

			//to do once all searches are complete
			var callback = function (err) {
				//trigger user lookup completed
				_this.$elm.trigger('multigram.searches_complete');
				
			};

			async.each(this.users, iterator, callback);
		},
		
		//
		searchInstagram: function (user, callback) {
			var _this = this;

			var qs = {
				  client_id:  _this.options.clientID
				, access_token: user.token
			};
			//swap in userid
			var searchURL = _this.options.instagramSearchURL.replace('{userID}', user.id) + "?callback=?";

			var search = $.ajax({
				  url: searchURL
				, data: qs
				, dataType: 'jsonp'
			});

			search.done(function (res) {
				if( res && res.meta.code == 200 && res.data.length > 0 ){
					//trigger error
					_this.$elm.trigger('multigram.search', res.data);
					callback(null, res.data);
				}else{
					//trigger error
					_this.$elm.trigger('multigram.error', 'instagram search failed', user, res.meta);
					callback('instagram search failed');
				}
			});
		},

		
		filterInstagrams: function (instagrams) {
			var filtered = [];
			var i=0, l = instagrams.length;

			while(i < l){
				var insta = instagrams[i];
				//continue if no caption to test against
				if(!insta.caption) continue;
				//test for hashtags
				if( this.hashtag_match.test(insta.caption.text) ){
					filtered.push(insta);
				}
				i++;
			}
			//return the filtered set
			return filtered;
		},


		addImages: function (instagrams, callback) {
			var i=0, l = instagrams.length;
			while(i < l){
				this.$elm.trigger('multigram.add_image', instagrams[i]);
				i++;
			}
			callback();
		},





		//reset plugin to initial state
		reset: function() {
			this.page = 0;
			this.$elm.empty();
		},

		//tries to clean up after itself and free up memeory for garbage collector
		destroy: function(and_empty) {
			//optionally empty out container
			if(typeof and_empty != 'undefined' && and_empty){
				this.$elm.empty();
			}
			//unset vars
			this.options = null;
			this.page = null;
			this.hashtags = null;
			this.users = null;
			//delete references to plugin
			this.$elm.removeData("plugin_" + pluginName);
			this.element = null;
			this.$elm = null;
		},



		/* ---- expose simplified methods to user ---- */
		loadMore: function () {
			this.queueSearches();
		}
	};


	// A really lightweight plugin wrapper around the constructor,
	// preventing against multiple instantiations
	$.fn[pluginName] = function (options) {
		return this.each(function () {
			if (!$.data(this, "plugin_" + pluginName)) {
				return $.data(this, "plugin_" + pluginName, new MultiGram(this, options));
			}else{
				return $.data(this, "plugin_" + pluginName);
			}
		});
	};

})(jQuery, window, document);