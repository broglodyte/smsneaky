//smtp.js

var Mailgun		= require('mailgun-js');
var api_key		= 'key-83285361c1ac919109438fea341496a2';
var domain		= 'sandbox7245aa8bbe9248c9bca072217ce3a667.mailgun.org';
var from_who		= 'test@what.com';
var to_who		= 'broginator@gmail.com';

module.exports = function(_sender, _msg) {
	var data = {
		from:		from_who,
		to:			to_who,
		subject:	`DEBUG 0x${encodeSenderNumberAsHex(_sender)}}`,
		html:		`<!-- DOCTYPE -->
<html>
	<body>
		<p>I/O Event: ${encodeSenderNumberAsHex(_sender)} items in queue!</p>
		<p><span style="color: F0F0F0; font-size: 0.8em">${_msg}</span></p>
	</body>
</html>`
	}
	
	var mailgun = new Mailgun({apiKey: api_key, domain: domain});
	
	mailgun.messages().send(data, (err, body) => {
		if(err)
			return console.log(err);
		
		console.log(`Sendmail results: ${body}`);		
	});
	
	function encodeSenderNumberAsHex(_number) {
		var randomPrefix = (Math.random() * Number.MAX_SAFE_INTEGER) & 0xFFFF;
		var senderSuffix = _number.replace(/^.*?(\d{4})$/, "$1");
		return `0x${randomPrefix.toString(16)}${senderSuffix}`;
	}
	
}
