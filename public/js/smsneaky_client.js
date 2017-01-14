//	smsneaky_client.js

$(document).ready(function() {
	populateConversationList();
	$("#convSelect").change(selectConversation);
	$("input#textEntry").keydown(sendMessageDelegate);
	setInterval(populateConversationList, 15000);
});



function selectConversation() {	
	var convPanel = $("#conversation");
	convPanel.empty();
	
	var selectedConversation = $("select#convSelect")[0].value;
	if(!selectedConversation || !selectedConversation.length)
		return;
	
	var conversationUrl = '/conversation/' + selectedConversation;
	
	$.getJSON(conversationUrl, function(conversation) {
		console.log('Conversation length: ['+conversation.length+']');
		$("input#textEntry").clear();
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
			
//			var tr = $("<tr></tr>");
//			var td = $("<td></td>");
			var newDiv = $("<div>").addClass("msgRowDiv");
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
//			td.html(p);
//			tr.html(td);
			newDiv.append(p);
			$("convDiv").append(newDiv);
		}
		
	});
}

function sendMessageDelegate(e) {
	if(e.which == 13)
		sendMessage();
}

function sendMessage() {
	var msg = $("input#textEntry").val();
	var recip = $("input#contact").val();	
	
	if(!msg)
		return;
	
	if(!recip)
		return alert('Please select a contact');
	
	var msgBlob = {
		toNumber:	recip,
		text:		msg		
	};
	var ajaxParams = {
		url: "/outgoing",
		method: "POST",
		username: "d",
		password: "d",
		headers: {
			"content-type": "application/json",
			"cache-control": "no-cache"
		},
		data: JSON.stringify(msgBlob),
		success: function(data, status) {
			console.log('Data:   '+data);
			console.log('Status: '+status);
			selectConversation();
		},
		error: function(jqXHR, status, err) {
			alert(status + '\n' + err);
		}
	}
	
//	console.log(ajaxParams.data);
	$.ajax(msgBlob);
}


function populateConversationList() {
//	clearConversationList(convSelect);
//	$("#convSelect").empty();
	
		var urlPath = '/conversation';
	$.getJSON(urlPath, function(convList) {
//		convSelect.children('option:not(:first)').remove();
		var contactDataList = $("datalist#contacts");
		contactDataList.empty();
		var dropdownOptionsList = convList.map(function(item) {
			var convName = item.name || item.number;
			var newOptionElement = $('<option>').text(convName).attr({value: item.number});
//			newOptionElement.text = item.name;
//			newOptionElement.value = item.number;
			contactDataList.append(newOptionElement);
		});
	});
}