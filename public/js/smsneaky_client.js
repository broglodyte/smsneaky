//	smsneaky_client.js

$(document).ready(function() {
	populateConversationList();
	$('#convSelect').change(selectConversation);
	setInterval(populateConversationList, 15000);
});



function selectConversation() {	
	var textTemplate = '<li><p class="__PCLASS__"><span class="timeLabel">__DATETIME__</span><br/><span>__TEXT__</span></p></li>';
	$("ul#conversation").empty();
	
	var selectedConversation = convSelect.value;
	if(!selectedConversation || !selectedConversation.length)
		return;
	
	var conversationUrl = '/conversation/' + selectedConversation;
	
	$.getJSON(conversationUrl, function(conversation) {
		console.log('Conversation length: ['+conversation.length+']');
		//	[conversation] should be a timestamp-ordered list of message objects. 
		
		//	TODO: make this conversation.forEach(fn) ?
		for(var i=0;i<conversation.length;i++) {
			var msgObj = conversation[i];
			if(!msgObj.type) {
				console.log('msgObj:');
				console.log(msgObj);
				continue;
			}
			
			var pClass = msgObj.type.startsWith('outbound') ? "fromMe" : "toMe";
			
			var li = $("<li></li>");			
			var p = $("<p></p>").addClass(pClass);
			
			var time = $("<span></span>").addClass('timeLabel').text(msgObj.dateTime);
			var br   = $("<br />");
			var data;
			
			var invalid = false;
			switch(msgObj.type) {
				case 'inboundText':
				case 'outboundText':
					data = $("<span></span>").text(msgObj.data);
					break;
					
				case 'inboundMedia':
					data = $('<img>')
						.addClass('mmsImg')
						.attr({
							src:	msgObj.data,
							id:		'img_'+msgObj._id
						});
					break;
					
				case 'voiceMail':
					data = $('<audio controls></audio>').addClass('mmsAudio');
					data.attr({src: msgObj.data});
					data.html($("<a></a>").attr({href: msgObj.data}).text('Download <span class="glyphicon glyphicon-volume-up"></span>'));
					break;
				default:
					console.log('Unknown message type: "'+msgObj.type+'"');
					invalid = true;
					break;
			}
			
			if(invalid)
				continue;
			
			p.append(time, br, data);
			li.append(p);
//			var newBlob = textTemplate.replace(/__([A-Z]+)__/g, function(match, p1) {
//				console.log("match: " + match);
//				console.log("p1:    " + p1);
//				switch(p1) {
//					case "PCLASS":
//						return pClass;
//					case "DATETIME":
//						return msgObj.dateTime;
//					case "TEXT":
//						return msgObj.data;
//					default:
//						return "";
//				}
//			});
			$("ul#conversation").append(li);
		}
	});
}


function populateConversationList() {
	var urlPath = '/conversation';
	var convSelect = $("#convSelect");
//	clearConversationList(convSelect);
//	$("#convSelect").empty();
	
	$.getJSON(urlPath, function(convList) {
		convSelect.children('option:not(:first)').remove();
		var dropdownOptionsList = convList.map(function(item) {
			var convName = item.name || item.number;
			var newOptionElement = $('<option></option>').text(convName).attr({value: item.number});
//			newOptionElement.text = item.name;
//			newOptionElement.value = item.number;
			convSelect.append(newOptionElement);
		});
	});
}