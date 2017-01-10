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
		//	[conversation] should be a timestamp-ordered list of message objects. 
		//	Clear [mainConversationDiv] div and add sub-divs for each:
		
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
//			p.attr({class: pClass});
//			p.addClass(pClass);
			
			var time = $("<span></span>").addClass('timeLabel').text(msgObj.dateTime);
			var br   = $("<br />");
			var text = $("<span></span>").text(msgObj.data);
			
			p.append(time, br, text);
			li.append(p);
			var newBlob = textTemplate.replace(/__([A-Z]+)__/g, function(match, p1) {
				console.log("match: " + match);
				console.log("p1:    " + p1);
				switch(p1) {
					case "PCLASS":
						return pClass;
					case "DATETIME":
						return msgObj.dateTime;
					case "TEXT":
						return msgObj.data;
					default:
						return "";
				}
			});
			$("ul#conversation").append(newBlob);
		}
	});
}
/*

<li>
	<p class="fromMe">
		<span class="timeLabel">1:46:09 PM</span>
		<br />Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
	</p>
</li>
*/

function populateConversationList() {
	var urlPath = '/inbox/from';
	var convSelect = document.getElementById('convSelect');
//	clearConversationList(convSelect);
//	$("#convSelect").empty();
	$("#convSelect").children('option:not(:first)').remove();
	
	$.getJSON(urlPath, function(convList) {
		var dropdownOptionsList = convList.map(function(item) {
			var convName = item.name;
			var newOptionElement = document.createElement('option');
			newOptionElement.text = item.name;
			newOptionElement.value = item.number;
			convSelect.add(newOptionElement);
		});
	});
}