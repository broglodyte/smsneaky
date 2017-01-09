//	smsneaky_client.js

$(document).ready(populateConversationList);
setInterval(populateConversationList, 15000);

$('#convSelect').change(selectConversation);

function selectConversation() {	
	var selectedConversation = convSelect.value;
	var conversationUrl = '/conversation/' + selectedConversation;
	
	$.getJSON(conversationUrl, function(conversation) {
		//	[conversation] should be a timestamp-ordered list of message objects. 
		//	Clear [mainConversationDiv] div and add sub-divs for each:
		
		$("#mainConversationDiv").empty();
		
		
	});
	
}

function populateConversationList() {
	var urlPath = '/inbox/from';
	var convSelect = document.getElementById('convSelect');
//	clearConversationList(convSelect);
	$("#convSelect").empty();
	
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

function clearConversationList(_select) {
	for (var i=_select.options.length-1; i>0; i--)
		_select.remove(i);
}