//	smsneaky_client.js
//

var convDisplayDiv      = "div#convDisplayDiv";
var contactInput = "input#contactInput";
var messageInput = "textarea#messageInput";
var optionsLink  = "a#optionsLink";
var charMeter    = 'meter#charMeter';

if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
}

$(document).ready(function() {
	$.ajaxSetup({contentType: "application/json; charset=utf-8"});
	populateConversationList();
	
	$(contactInput).on({
		input:		selectConversation,
		// select:		selectConversation,
		// change:		selectConversation,
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
	$(document).keypress(function() {
		updateCharMeter();
	});
	
	$(document).on('mouseenter', '.deletable', function(e) {
		showX(this.id);
	});
	
	$(document).on('mouseleave', '.deletable', function(e) {	
		hideX(this.id);
	});
	
	setInterval(updateCharMeter, 500);
	
	var socket = io();
	socket.on('incoming', recvMessage);
});

function updateCharMeter() {
	$(charMeter).val($(messageInput).val().length);
}

function showX(msgID) {
	$('div#msg_'+msgID+' img.deleteX').animate(
			{left: "1px", opacity: 1.0},
			{queue: false, duration: 200});
}

function hideX(msgID) {	
	$('div#msg_'+msgID+' img.deleteX').animate(
			{left: "15px", opacity: 0.0},
			{queue: false, duration: 200});
}

function openOptionsDialog() {
	
}

//	do stuff when key is pressed at [contact] input
function handleContactKeyPress(e) {
	switch(e.keyCode) {
		case 27:
			$(contactInput).val('');
			$(convDisplayDiv).empty();
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
		// case 9:
			// $(contactInput).focus();
			// break;
			
		//	user pressed 'enter' key, check for alt/ctrl modifier
		case 13:
			if(e.ctrlKey) {
				var toNumber = $(contactInput).val();
				var message  = $(messageInput).val();
				sendMessage(toNumber, message);
			}				
			break;
		
		//	user pressed 'esc' key, clear out message entry text
		case 27:
			$(messageInput).val('');
			break;
	}
	
}

function selectConversation() {
	// $(convDisplayDiv).empty();
	clearConversation();
	
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
	var convMesssages = $(convDisplayDiv).children();
	$(convDisplayDiv).children().sort(function(a, b) {
		if(a.id < b.id)
			return -1;
		if(a.id > b.id)
			return 1;
		return 0;
	}).each(function(i) {
		this.remove();
		
	});
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
	var p = $("<p></p>").addClass(pClass).addClass('deletable').attr({id: msgObj._id});
	
	var header = $("<div></div>").addClass('msgHeader');
	var time = $("<span></span>").addClass('timeLabel').text(msgObj.dateTime);
	// var deleteButton = $("<a></a>").addClass('deleteX').attr({id: 'delete_'+msgObj._id}).html($("<img>").attr({src: '/img/x.gif'}));
	var deleteButton = $("<img>").addClass('deleteX').attr({src: '/img/x_medium.gif', id: 'delete_'+msgObj._id});
	deleteButton.click(deleteMessage.bind(undefined, msgObj._id, msgObj.type.startsWith('outbound')));
	header.append(time, deleteButton);
	deleteButton.css({opacity: 0.0, left: 10, top: 0, width: 7, height: 7});
	
	var br   = $("<br>");
	var data;
	
	var invalid = false;
	switch(msgObj.type) {
		case 'inboundText':
		case 'outboundText':
			data = $("<span></span>").html(msgObj.data.replace(/\n/, '<br>'));
			break;
			
		case 'inboundMedia':
			var img_Blurred = $('<img>')
				//.addClass('blurImage')//
				.attr({
					src:	msgObj.data,
					id:		'img_'+msgObj._id+'_blurred'
				});
			// var img_Clear = $('<img>')
				// .addClass('clearImage')
				// .attr({
					// src:	msgObj.data,
					// id:		'img_'+msgObj._id+'_clear'
				// })
				
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
		p.append(header, br, data);
		newDiv.append(p).hide();
		$(convDisplayDiv).append(newDiv);
		newDiv.fadeIn({queue: false});
	}
}

function recvMessage(txtData) {
	console.log(txtData);
}

function sendMessage(rec, msg) {
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

function deleteMessage(_msgID, outgoing) {
	var delRequest = $.ajax({
		method: 'DELETE',
		url: '/msg/' + _msgID,
		complete: function(response) {
			console.log(response);
			if(response && response.status === 204) {
				$('#msg_' + _msgID).fadeOut(1000);//.animate({left: (outgoing ? '-' : '+' ) + '=500'}, 1000).remove();
			}
			else {
				notify("Error deleting message: " + response.results);
			}
		}
	}).fail(function(blah) { 
		alert('FAIL');
	});
}

function notify(msg) {
	alert(msg);
}

function scrollToEnd() {
	$(convDisplayDiv).animate({ scrollTop: $(convDisplayDiv).prop("scrollHeight")}, 250);
}


function populateConversationList() {
	$.getJSON('/conversation', function(convList) {
		
		//var contactDataList = $("datalist#contacts");
		//contactDataList.empty();

		var listObj = $('<ul></ul>').attr({id: 'convList'});
		convList.map(function(item) {
			//var newOptionElement = $('<option></option>').text(item.name || '?').attr({value: item.number});
			var newConvEntry = $(''
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
    
