/* demo.js - Havi Sullivan, 9/21/2012 */
var feed;

// gets everything started (called by window load at end of js)
function init() {
	if (featureCheck())
	{
		feed = new TwitterFeed({ 
			containerId: 'tweetlist',
			childElementTag: 'li',
			childTemplateId: 'template',
			errorId: 'feederror',
			titleTemplate: '(###) Twitter Demo - Havi Sullivan',
			titleTemplateNoTweets: 'Twitter Demo - Havi Sullivan'
			});
		feed.start();
	}
	else
	{
		var elem = document.getElementById('notsupported');
		elem.style.display = 'block';
	}
}

// make sure we have a browser that has what we need
function featureCheck() {
	return (typeof XMLHttpRequest != 'undefined') &&
		(typeof JSON != 'undefined') &&
		(typeof Function.prototype.bind != 'undefined');
}

// TwitterFeed class does all the work
//   containerId - the ID of the place where the tweets will go
//   childElementTag - the type of tag to create as children of the container
//   childTemplateId - the ID that contains the tweet template elements
//   errorId - the ID of the element to display if an error occurs
//   displayLimit - the maximum number of tweets to show in the list
//   pollInterval - sets the number of seconds to wait before polling for more tweets
//                  (keep this number high or you'll anger the Twitter gods)
//   serverUrl - location of the server endpoint for getting tweets
//   titleTemplate - if set, contains a template for the page title, replacing ### with the
//                   number of tweets
//   titleTemplateNoTweets - same as above for when there are no tweets pending
function TwitterFeed(options)
{
	this.containerId = options.containerId;
	this.childElementTag = options.childElementTag;
	this.childTemplateId = options.childTemplateId;
	this.errorId = options.errorId;
	this.displayLimit = options.displayLimit || 100;
	this.pollInterval = options.pollInterval || 15;
	this.serverUrl = options.serverUrl || 'tweets.php';
	this.tweetCountTemplate = options.tweetCountTemplate || '### new';
	this.titleTemplate = options.titleTemplate || null;
	this.titleTemplateNoTweets = options.titleTemplateNoTweets || null;
	
	this.lastTweet = null;
	this.lastFullTweet = null;
	this.sinceLast = 0;
	this.currentTimer = null;
}

TwitterFeed.prototype = {

	// starts the feed
	'start': function() {
		this.stop();
		this.lastTweet = null;
		this.lastFullTweet = null;
		this.sinceLast = 0;
		this.currentTimer = null;
		this.pollTweets();
	},
	
	// stops the feed
	'stop': function() {
		if (this.currentTimer != null)
		{
			window.clearTimeout(this.currentTimer);
			this.currentTimer = null;
		}
	},

	// handles polling for new tweets (first call will get full tweets, subsequent just a count)
	'pollTweets': function() {
		var xhrq = new XMLHttpRequest();
		xhrq.onreadystatechange = (function() {
			if (xhrq.readyState == 4)
			{
				if (xhrq.status == 200)
				{
					var tweets = JSON.parse(xhrq.responseText);
					this.displayTweets(tweets, this.lastTweet != null);
					this.currentTimer = window.setTimeout(this.pollTweets.bind(this), 1000 * this.pollInterval);
				}
				else
				{
					this.displayError(xhrq.responseText);	
				}
			}
		}).bind(this);
		var url = this.serverUrl + '?';
		if (this.lastTweet != null)
			url += 'since=' + escape(this.lastTweet);
		else
			url += 'full=true';
		xhrq.open('GET', url, true);
		xhrq.send();
	},

	// forces a request to get more full tweets
	'getLatestTweets': function() {
		if (this.lastFullTweet == null)
			return;
		if (this.currentTimer != null)
		{
			window.clearTimeout(this.currentTimer);
			this.currentTimer = null;
		}
		var since = this.lastFullTweet;
		this.lastFullTweet = null;
		
		var xhrq = new XMLHttpRequest();
		xhrq.onreadystatechange = (function() {
			if (xhrq.readyState == 4)
			{
				if (xhrq.status == 200)
				{
					var elem = document.getElementById('tweetcount');
					elem.parentNode.removeChild(elem);
					
					var tweets = JSON.parse(xhrq.responseText);
					this.displayTweets(tweets, false);
					this.currentTimer = window.setTimeout(this.pollTweets.bind(this), 1000 * this.pollInterval);
				}
				else
				{
					this.displayError(xhrq.responseText);
					this.lastFullTweet = since;
				}
			}
		}).bind(this);
		var url = this.serverUrl + '?since=' + escape(since) + '&full=true';
		xhrq.open('GET', url, true);
		xhrq.send();
	},

	// inserts tweets and tweet counts into the page
	'displayTweets': function(tweets, countOnly) {
		var list = document.getElementById(this.containerId);
		var appendBefore = null;
		if (list.firstElementChild)
		{
			if (list.firstElementChild.id == 'tweetcount')
				appendBefore = list.firstElementChild.nextElementSibling;
			else if (list.firstElementChild.id == 'loading')
				list.removeChild(list.firstElementChild);	
			else
				appendBefore = list.firstElementChild;
		}
		var count = 0;
		for (key in tweets.statuses)
		{
			var tweet = tweets.statuses[key];
			if (countOnly == false)
			{
				var li = document.createElement(this.childElementTag);
				li.id = 'tweet' + tweet.id_str;
				li.className = 'tweet';
				this.applyTemplate(li, tweet);
				if (appendBefore != null)
					list.insertBefore(li, appendBefore);
				else
					list.appendChild(li);
			}
			count++;
		}
		this.lastTweet = tweets.search_metadata.max_id_str;
		if (countOnly && count > 0)
		{
			this.sinceLast += count;
			var elem = document.getElementById('tweetcount');
			if (elem)
				elem.parentNode.removeChild(elem);
			var li = document.createElement(this.childElementTag);
			li.id = 'tweetcount';
			li.innerHTML = this.tweetCountTemplate.replace('###', this.sinceLast);
			li.onclick = this.getLatestTweets.bind(this);
			list.insertBefore(li, list.firstChild);
		}
		else if (!countOnly)
		{
			this.lastFullTweet = this.lastTweet;
			this.sinceLast = 0;
			this.limitDisplay();
		}
		this.applyTitleTemplate(this.sinceLast);
	},
	
	// applies the defined template for a specific tweet
	'applyTemplate': function(element, tweet) {
		var template = document.getElementById(this.childTemplateId);
		if (template.hasChildNodes())
		{
			var node = template.firstChild;
			while (node != null)
			{
				if (node.nodeType == 1)
				{
					var newNode = node.cloneNode(true);
					this.applyTweetProperties(newNode, tweet);
					element.appendChild(newNode);
				}
				else if (node.nodeType == 3)
				{
					element.appendChild(node.cloneNode(false));
				}
				node = node.nextSibling;
			}
		}
	},
	
	// looks for elements (recursive) that have known classes for dropping in tweet data
	'applyTweetProperties': function(element, tweet) {
		// should contain ability to separate multiple classes out, but for now keeping it simple
		var textToAdd = null;
		switch (element.className)
		{
			case 'tweet-image':
				element.src = tweet.user.profile_image_url;
				break;
			case 'tweet-text':
				textToAdd = tweet.text;
				break;
			case 'tweet-datetime':
				textToAdd = new Date(tweet.created_at).toLocaleString();
				break;
			case 'tweet-screenname':
				textToAdd = tweet.user.screen_name;
				break;
		}
		if (textToAdd != null)
		{
			element.insertAdjacentHTML('beforeend', textToAdd);
		}
		
		if (element.hasChildNodes())
		{
			for (key in element.childNodes)
			{
				var node = element.childNodes[key];
				if (node.nodeType == 1)
					this.applyTweetProperties(node, tweet);	
			}
		}
	},
	
	// attempts to apply the # of tweets to the title tag
	'applyTitleTemplate': function(numberOfTweets) {
		var titleTag = document.getElementsByTagName('title');
		if (titleTag.length < 1) return;
		if (numberOfTweets > 0 && this.titleTemplate != null)
		{
			titleTag[0].innerHTML = this.titleTemplate.replace('###', numberOfTweets.toString());
		}
		else if (this.titleTemplateNoTweets != null)
		{
			titleTag[0].innerHTML = this.titleTemplateNoTweets;
		}
	},

	// this just keeps the list reasonable by cleaning up old tweets
	'limitDisplay': function() {
		var list = document.getElementById(this.containerId);
		var count = 0;
		var node = list.firstElementChild;
		while (node != null)
		{
			var nextNode = node.nextElementSibling;
			if (node.id != 'tweetcount')
			{
				count++;
				if (count > this.displayLimit)
					node.parentNode.removeChild(node);
			}
			node = nextNode;
		}
	},

	// show error if we can't talk to server
	'displayError': function(message) {
		var elem = document.getElementById(this.errorId);
		elem.style.display = 'block';
		console.log(message);
	}
}

window.onload = init;