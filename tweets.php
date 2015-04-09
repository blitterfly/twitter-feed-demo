<?php
// Havi Sullivan, 9/21/2012
date_default_timezone_set('UTC');

// app keys were removed! won't work unless you provide your own
define('CONSUMER_KEY', 'x');
define('CONSUMER_SECRET', 'x');
define('ACCESS_TOKEN', 'x');
define('ACCESS_SECRET', 'x');
define('BASE_URL', 'https://api.twitter.com/1.1/search/tweets.json');

// had to write this since OSX didn't have 5.4.0 installed (would have loved 4th param on http_build_query to keep it simple)
function twitencode($arr) {
	$retval = '';
	foreach ($arr as $key => $value)
	{
		if (strlen($retval) > 0) $retval .= '&';
		$retval .= rawurlencode($key) . '=' . rawurlencode($value);
	}
	return $retval;
}

// for sorting, later
function sortbycreated($tweet1, $tweet2) {
	$date1 = date($tweet1->created_at);
	$date2 = date($tweet2->created_at);
	if ($date1 == $date2)
		return 0;
	if ($date1 < $date2)
		return 1;
	return -1;
}

// base search query
$data = array('q' => '#MyLittlePony OR #brony OR @MyLittlePony OR #mlp OR #mlpfim', 'count' => 50, 'result_type' => 'recent',
	'include_entities' => 'false');
if (isset($_GET['since']))
	$data['since_id'] = $_GET['since'];
$query = twitencode($data);
//echo '<p>' . $query . '</p>';

/*
 * I would like to point out that I didn't copypasta this code from anywhere... I actually figured it out on my own
 * by reading the specs on the Twitter dev site. Which means I was really concerned when it worked the first time. o.O
 */
  
// generate signature for OAuth
$nonce = uniqid('', TRUE);
$timestamp = time();
$data['oauth_consumer_key'] = CONSUMER_KEY;
$data['oauth_nonce'] = $nonce;
$data['oauth_signature_method'] = 'HMAC-SHA1';
$data['oauth_timestamp'] = $timestamp;
$data['oauth_token'] = ACCESS_TOKEN;
$data['oauth_version'] = '1.0';
ksort($data, SORT_STRING);
//print_r($data);

$base_signature = 'GET&' . rawurlencode(BASE_URL) . '&' . rawurlencode(twitencode($data));
//echo '<p>' . $base_signature . '</p>';
$signing_secret = rawurlencode(CONSUMER_SECRET) . '&' . rawurlencode(ACCESS_SECRET);
$signature = base64_encode(hash_hmac('sha1', $base_signature, $signing_secret, TRUE));
//echo '<p>' . $signature . '</p>';

$cn = curl_init(BASE_URL . '?' . $query);
curl_setopt($cn, CURLOPT_FRESH_CONNECT, TRUE);
curl_setopt($cn, CURLOPT_RETURNTRANSFER, TRUE);
curl_setopt($cn, CURLOPT_HTTPHEADER, array(
'Authorization: OAuth oauth_consumer_key="' . CONSUMER_KEY . '", oauth_nonce="' . $nonce . '", oauth_signature="' . rawurlencode($signature) . '", oauth_signature_method="HMAC-SHA1", oauth_timestamp="' . $timestamp . '", oauth_token="' . ACCESS_TOKEN .'", oauth_version="1.0"'));

$text = curl_exec($cn);

if ($text === FALSE)
{
	header("HTTP/1.1 500 Server Error");
	header("Content-Type: text/plain");
	header("Status: 500 Server Error");
    echo curl_error($cn);
}
else
{
	/*
	 * To be honest, if this was for reals I'd definitely clean up the data set a bit more, reduce the size of the payloads to the
	 * client etc. For this demo, it was easier just to pass through Twitter's data. You get the idea. :)
	 */
	$tweets = json_decode($text);
	if (isset($tweets->errors))
	{
		header("HTTP/1.1 500 Server Error");
		header("Content-Type: text/plain");
		header("Status: 500 Server Error");
	    echo $tweets->errors[0]->message;		
	}
	else
	{
		usort($tweets->statuses, 'sortbycreated');
		
		header("Content-Type: application/json");
		if (isset($_GET['full']))
		{
		    echo json_encode($tweets);
		}
		else
		{
			echo '{ "statuses": [';
			$first = TRUE;
			foreach ($tweets->statuses as $tweet)
			{
				if ($first)
					$first = FALSE;
				else
					echo ',';
				echo ' { ';
				echo '"id": "' . $tweet->id . '"';
				echo ' } ';
			}
			echo '], "search_metadata" : { "max_id_str" : "' . $tweets->search_metadata->max_id_str . '" }';
			echo ' }';
		}
	}
}

curl_close($cn);
?>