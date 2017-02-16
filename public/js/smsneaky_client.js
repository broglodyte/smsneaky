//	smsneaky_client.js
//
var convDiv = "div#convDiv";
var contactInput = "input#contact";
var messageInput = "textarea#messageInput";
var optionsLink  = "a#optionsLink";

$(document).ready(function() {
	$.ajaxSetup({contentType: "application/json; charset=utf-8"});
	populateConversationList();
	
	$(contactInput).on({
		input:		selectConversation,
		select:		selectConversation,
		change:		selectConversation,
		keydown:	handleContactKeyPress
	});
	$(messageInput).keydown(handleMessageKeyPress);
		
	function tog(v) {
		return v ? 'addClass' : 'removeClass';
	} 
	$(document).on('input', '.clearable', function() {
		$(this)[tog(this.value)]('clearX');
	}).on('mousemove', '.clearX', function( e ){
		$(this)[tog(this.offsetWidth-18 < e.clientX-this.getBoundingClientRect().left)]('onClearX');
	}).on('touchstart click', '.onClearX', function( ev ){
		ev.preventDefault();
		$(this).removeClass('clearX onClearX').val('').change();
		
	});
	
	$(document).on('click', '.deletable', function(e) {
		
	});
	
	textareaResize($(messageInput), $("#charMeter"));	
	
	$(optionsLink).click(openOptionsDialog);
	
	var socket = io();
	socket.on('incoming', routeIncomingText);
});

function openOptionsDialog() {
	
}


function routeIncomingText(txtData) {
	
	
}

//	do stuff when key is pressed at [contact] input
function handleContactKeyPress(e) {
	switch(e.keyCode) {
		case 27:
			$(contactInput).val('');
			$(convDiv).empty();
			break;
			
		case 9:
		case 13:
			selectConversation();
			break;
	}
}

//	do stuff when key is pressed from [message]
function handleMessageKeyPress(e) {
	switch(e.which) {
		case 9:
			$(contactInput).focus();
			break;
			
		//	user pressed 'enter' key, check for alt/ctrl modifier
		case 13:
			if(e.altKey) {
				alert('sending message');
				sendMessage();
			}
			break;
		
		//	user pressed 'esc' key, clear out message entry text
		case 27:
			$(messageInput).val('');
			break;
	}
	
	$('meter#charMeter').val($(this).val().length);
}

function selectConversation() {
	$(convDiv).empty();
	
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

function clearConversation() {
	var convMesssages = $(convDiv).children();
	$('div[id=convDiv] > p').empty();
}

function loadConversation(msgArray) {
	clearConversation();
	
	for(var i=0;i<msgArray.length;i++)
		appendMessageToConversation(msgArray[i]);
	
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
	
	var header = $("<div></div>").addClass('msgHeader');
	var time = $("<span></span>").addClass('timeLabel').text(msgObj.dateTime);
	var deleteButton = $("<a>X</a>").addClass('deleteX');
	deleteButton.click(deleteMessage.bind(undefined, msgObj._id));
	header.append(time, deleteButton);
	
	// var br   = $("<br>");
	var data;
	
	var invalid = false;
	switch(msgObj.type) {
		case 'inboundText':
		case 'outboundText':
			data = $("<span></span>").text(msgObj.data);
			break;
			
		case 'inboundMedia':
			var img_Blurred = $('<img>')
				//.addClass('blurImage')//
				.attr({
					src:	msgObj.data,
					id:		'img_'+msgObj._id+'_blurred'
				});
			var img_Clear = $('<img>')
				.addClass('clearImage')
				.attr({
					src:	msgObj.data,
					id:		'img_'+msgObj._id+'_clear'
				})
				
			data = $('<div></div>').addClass('imgContainer').append(img_Blurred);
			
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
		p.append(header, data);
		newDiv.append(p).hide();
		$(convDiv).append(newDiv);
		newDiv.fadeIn({queue: false});
	}
}

function deleteMessage(_msgID) {
	var delRequest = $.ajax({
		method: 'DELETE',
		url: '/msg/' + _msgID
	}).done(function(response) {
		if(response.success) {
			$('msg_' + msgID).animate({left: "-100px"}, 1000).remove();
		}
		else {
			notify("Error deleting message: " + response.results);
		}
		
	}).fail(function(blah) { 
		alert('FAIL');
	});
}

function notify(msg) {
	alert(msg);
}

function scrollToEnd() {
	$(convDiv).animate({ scrollTop: $(convDiv).prop("scrollHeight")}, 250);
}


function recvMessage() {}

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
		var contactDataList = $("datalist#contacts");
		contactDataList.empty();
		convList.map(function(item) {
			var newOptionElement = $('<option></option>').text(item.name || '?').attr({value: item.number});
			contactDataList.append(newOptionElement);
		});
	});
}

function embiggenPicture(imgID) {
	//	...
	var docWidth = $("div#mainDiv").width();
	var docHeight = $("div#mainDiv").height();
}


var textareaResize = function(source, dest) {
    var resizeInt = null;
    
    // the handler function
    var resizeEvent = function() {
		var textBoxHeight = source.outerHeight();
		
		var right = -12 + (40 - dest.width());
		var top = -26 + (40 - dest.width());
		//dest.css({right: right, top: top});
		
		console.log(`Right: ${right}`);
		console.log(`Top:   ${top}`);
        //dest.outerHeight(source.outerHeight());
    };

    source.on("mousedown", function(e) {
        resizeInt = setInterval(resizeEvent, 10);
    });

    // The mouseup event stops the interval,
    // then call the resize event one last time.
    // We listen for the whole window because in some cases,
    // the mouse pointer may be on the outside of the textarea.
    $(window).on("mouseup", function(e) {
        if (resizeInt !== null) {
            clearInterval(resizeInt);
        }
        resizeEvent();
    });
};
    
