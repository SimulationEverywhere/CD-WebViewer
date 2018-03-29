/*******************************************************
 * Author: 	Omar Hesham, June 2015.
 * Advanced Real-Time Simulation Lab.
 * Carleton University, Ottawa, Canada.​​
 * License: [TODO] Something opensource
 *
 * Project: 	Online Cell-DEVS Visualizer
 * File: 		data.js
 * Description: Data input objects used by the View 
 * 				(view.js) and Model (model.js) components
 * 				of the main Grid object 				
 */

inp = {};
inp.fileLoaded = false;
inp.logLoaded = false;
inp.logParsed = false;
inp.file = [];
inp.logFile = {};
inp.usefulIndex = {first:-1,last:-1};
inp.chunkSize =      2097152; // 2^21 = 2MB approx.
inp.MAXFILESIZE = 5500000000; // for testing only: 5.5GB

// Process drag'n'dropped files
inp.processDroppedFiles = function(f){
	var file = f.files[0]; // process the first (and only?) file
	console.log(f.id + ' submitted');
	var fReader = new FileReader();

	//=== [TODO] Rewrite this into proper View/HTML spots, not here
	var statMsg = []; // array of status messages
	statMsg[0] = file.name+'<br><b>Loaded!!</b>';
	statMsg[1] = file.name+'<br><b>Processing...</b>';
	var statBox = document.getElementById(f.id).parentNode.children[3];	// statBox div
	statBox.innerHTML = statMsg[1]; 	// indicate file started processing
	//================
	
	if(f.id=='log-file'){
		//console.log(inp.file['log-file'].substr(0,100));
		//grid.parseYMessages();
		inp.logFile = file;
		inp.logLoaded = true;
		statBox.innerHTML = file.name+'<br><b>Ready to parse</b>';
		//inp.chunckifyEnds(file);
	}else{
		fReader.readAsText(file);
		fReader.onloadend = (function(){
			inp.file[f.id] = fReader.result; 
			if(f.id=='pal-file') inp.fileLoaded=true;
			//console.log('Status after file: '+fReader.readyState);
			console.log(f.id + ' loaded');
			statBox.innerHTML = statMsg[0]; 	// indicate file loaded
			//grid.initializeGridStvalues();
			//console.log(grid.initialStValues);
		});
	}

	// [TODO] Use internally defined model name, not file name.
	// Store file name (sans extension) as model name. 
	if(f.id == 'ma-file')
		grid.model.name = file.name.slice(0, file.name.lastIndexOf('.'));
}

/**
 * Note:
 * Chunkify() is for an offline viewer that deals with complete 
 * and known files sizes (i.e. not still simulating ala RISE).
 * There are implications here, in the model.js, and in the UI html.
 */
inp.readChunk = function(c,f,fr,s,e){		
	c = f.slice(s, e);
	fr.readAsText(c);	
}
inp.readChunkObj = function(obj){		
	// Same as readChunk() but with a single argument; simpler to call
	obj.chunk = obj.file.slice(obj.start, obj.end);
	obj.fileReader.readAsText(obj.chunk);	
}

inp.parseYChunks = function(){
	if(!inp.logLoaded) return; // if log not yet loaded, exit 

	grid.init() // reset grid data and reload input properties

	grid.model.frameBuffer = []; // set a new single frame buffer
	grid.model.lastT = [0,0,0,0];// set initial 'last parsed time'

	//------------------------		
	// C. Loop over chunks
	// -----------------------	
	// Define variables and constants
	var CHUNK_SIZE = inp.chunkSize;
	var statBox = document.getElementById('log-file').parentNode.children[3]; // statBox div
	var C = {					// Container for a single reader object
		file: inp.logFile,		// File handle (e.g. file.size, file.slice(), etc.)
		fileReader:'',			// FileReader handle (e.g. fileReader.readAsTest(), etc.)
		chunk:'',				// Chunk handle (e.g. chunk.type, chunk.slice(), etc.)
		chunkContent: '',		// Chunk content holder (string)
		chunkCount: 0,			// Count of *useful* chunks (containing y-messages)
		chunkSize:CHUNK_SIZE,	// Setup chunk size (in bytes)
		fileCaret: 0,			// Current file index being processed
		firstYMsgIndex: -1,		// File index of beginning of first y-message
	 	start: 0,				// First byte index of current chunk (init = 0)
	 	end: 0					// Last byte index of current chunk (init = CHUNK_SIZE)
	}

	// Prepare chunk parameters
	C.fileReader = new FileReader();	
	C.start = 0;
	C.end = C.start+C.chunkSize;
	// Read the chunk		
	inp.readChunkObj(C);	
	// Callback after chunk is read (or loaded)
	C.fileReader.onloadend = function(){
		// We have a chunk for sure (we just loaded one)
		C.chunkCount++;
		// Indicate some progress
		console.log('Chunk#'+(C.chunkCount-1)+' ('+(100*C.start/C.file.size).toFixed(5)+'%):');
		// Process the chunk we just read
		C.chunkContent = C.fileReader.result;
		// Only process full lines. Use safeEnd as starting point for next chunk
		var safeEndIndex = C.chunkContent.lastIndexOf('\n');
		// progress %
		var progress = (100*C.end/Math.min(C.file.size, inp.MAXFILESIZE));
		// Loading progress feedback to user
		grab('BtnParseY').innerHTML = 'Parsing log...('+progress.toFixed(2)+'%)';
		grab('BtnParseY').style.background = 'linear-gradient(to right, rgb(80,80,75) 0%,rgb(80,80,75)'+
											  progress+'%,rgba(35,112,77, 0.5) '+
											  progress+1+'%, rgba(35,112,77, 0.5)';

		// Check end of file
		if(C.end > C.file.size || C.end > inp.MAXFILESIZE){	// TEST ONLY: limit to 6GB
			grid.parseYMessages(C.chunkContent, safeEndIndex,true);		// signal lastChunk=true	
			statBox.innerHTML = C.file.name+'<br><b>All parsed!</b>';
			inp.logParsed = true;
			grab('BtnParseY').innerHTML = 'Parse Simulation Log';
			grab('BtnParseY').style.background = '';
			grab('BtnParseY').disabled = false;
			grid.modelMain();
			console.log('Finished parsing chunks (100%)');
			//console.log(grid.model.data);
			return;
		}	
		else
			grid.parseYMessages(C.chunkContent, safeEndIndex,false); // not lastChunk yet	
		// Otherwise, prep for next chunk:
		// 		increment because safeEnd is local to chunk 
		// 		if no '\n' detected, then skip to next chunk directly
		C.start += safeEndIndex!=0?safeEndIndex:C.chunkSize;	   
		C.end = C.start + C.chunkSize;	 

		// Read next chunk	
		inp.readChunkObj(C);
	}
}

// [TODO] Load the RISE settings .xml file
//grid.loadRISExml = function(){}