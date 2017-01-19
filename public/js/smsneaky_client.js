//	smsneaky_client.js
//
var convDivPanel = "div#convDiv";
var contactInput = "input#contact";
var messageInput = "input#textEntry";

$(document).ready(function() {
	$.ajaxSetup({contentType: "application/json; charset=utf-8"});
	populateConversationList();
	$(contactInput).on({
		input:		selectConversation,
		select:		selectConversation,
		change:		selectConversation,
		keydown:	handleContactKeyDown
	});
	$(messageInput).keydown(handleMessageKeyDown);
		
	function tog(v) {
		return v ? 'addClass' : 'removeClass';
	} 
	$(document).on('input', '.clearable', function() {
		$(this)[tog(this.value)]('x');
	}).on('mousemove', '.x', function( e ){
		$(this)[tog(this.offsetWidth-18 < e.clientX-this.getBoundingClientRect().left)]('onX');
	}).on('touchstart click', '.onX', function( ev ){
		ev.preventDefault();
		$(this).removeClass('x onX').val('').change();
	});
	
	var socket = io();
	socket.on('incoming', appendMessageToConversation);
	
	//setInterval(populateConversationList, 15000);
});

function handleContactKeyDown(e) {
	if(e.keyCode == 27) {
		$(contactInput).val('');
		$(convDivPanel).empty();
	}
	if(e.keyCode == 13) {
		selectConversation();
	}
}

function handleMessageKeyDown(e) {
	if(e.which == 13)
		sendMessage();
	if(e.which == 27)
		$(messageInput).val('');
}

function selectConversation() {
	$(convDivPanel).empty();
	
	var selectedConversation = $(contactInput).val();
	if(!selectedConversation || !selectedConversation.length)
		return;
	
	var conversationUrl = '/conversation/' + selectedConversation;
	
	$.getJSON(conversationUrl, function(conversation) {
		$(messageInput).val('');
		
		//	[conversation] should be a timestamp-ordered list of message objects. 
		loadConversation(conversation);
	});
}

function loadConversation(msgArray) {
	$(convDivPanel).empty();
	
	for(var i=0;i<msgArray.length;i++)
		appendMessageToConversation(msgArray[i])
	
	scrollToEnd();
}

function appendMessageToConversation(msgObj) {
	if(!msgObj || !msgObj.type) {
		console.log('msgObj:');
		console.log(msgObj);
		return;
	}
	
	var msgID = 'msg_' + msgObj._id;
	var pClass = msgObj.type.startsWith('outbound') ? "fromMe" : "toMe";			
	var newDiv = $("<div>").addClass("msgRowDiv").attr({id: msgID});
	var p = $("<p></p>").addClass(pClass);
	
	var time = $("<span></span>").addClass('timeLabel').text(msgObj.dateTime);
	var br   = $("<br>");
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
	
	if(!invalid) {
		p.append(time, br, data);
		newDiv.append(p).hide();
		$(convDivPanel).append(newDiv);
		newDiv.fadeIn({queue: false});
	}
}

function scrollToEnd() {
	$(convDivPanel).animate({ scrollTop: $(convDivPanel).prop("scrollHeight")}, 250);
}

function sendMessage() {
	var msg = $(messageInput).val();
	var rec = $(contactInput).val();	
	
	if(!msg)
		return;
	
	if(!rec)
		return alert('Please select a contact');
	
	var msgBlob = {
		contact:	rec,
		message:	msg		
	};
	
	$.post("/outgoing", JSON.stringify(msgBlob))
	.done(function(data) {
		appendMessageToConversation(data);
		scrollToEnd();
		$(messageInput).val('');		
	}).fail(function(err) {
		console.log('Error:   ' + err);
		alert('Error sending message: ' + err);
	});
}


function populateConversationList() {
	$.getJSON('/conversation', function(convList) {
//		convSelect.children('option:not(:first)').remove();
		var contactDataList = $("datalist#contacts");
		contactDataList.empty();
		convList.map(function(item) {
			var newOptionElement = $('<option>').text(item.name || '?').attr({value: item.number});
//			newOptionElement.text = item.name;
//			newOptionElement.value = item.number;
			contactDataList.append(newOptionElement);
		});
	});
}

function embiggenPicture(imgID) {
	//	...
	var docWidth = $("div#mainDiv").width();
	var docHeight = $("div#mainDiv").height();
}