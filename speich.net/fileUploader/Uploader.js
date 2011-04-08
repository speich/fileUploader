/**
 * Created by Simon Speich, www.speich.net
 * Date: 11.12.10, v1.0
 */
dojo.require('snet.DialogConfirm');
dojo.require('snet.fileUploader.ProgressBar');
/*dojo.require('snet.fileUploader.TempFileDb');*/
dojo.provide('snet.fileUploader.Uploader');

dojo.declare('snet.fileUploader.Uploader', null, {

	maxKBytes: 3000,	   // in kbytes limited by php.ini directive upload_max_filesize
	maxNumFiles: 10, 	   // limited by php.ini directive max_file_uploads
	bytesOverall: 0,
	barOverall: null,
	fileStatus: {
		numCompleted: 0,     // number of completely uploaded files
		numAborted: 0,			// number of canceled files
		numProgressDone: 0,	// number of files where upload progress is 100%
		numError: 0          // number of files with error
	},
	files: [],           // files that will be uploaded after checking their length and max allowed number of uploads
	progressBars: [],    // keeps track of created bars
	displayTarget: null, // If null, progress is displayed in a dialog, otherwise provide element id
	dropTarget: null,
	rememberConfirmDelete: false, // do not ask user again to confirm deleting

	/**
	 * Instantiates the fileUploader.
	 * Expects object with following properties:
	 *    id:      // {String|Object} DomNode or id of element that the progress bars are created in.
	 *    url:     // {String} url of php page that handles the upload
	 *    target:  // {String|Object} DomNode or id of element where files can be dropped onto
	 *
	 * @param {Object} props arguments
	 */
	constructor: function(props) {
		if (!this.hasFeatures())  {
			this.confirmHasFeatures();
		}
		else {
			props.dropTarget = dojo.byId(props.dropTarget);
			dojo.safeMixin(this, props);
			this.maxKBytes *= 1048;    // e.g. * (1024 + 24)

			// add drag and drop events
			dojo.connect(window, 'dragover', function(evt) {
				dojo.stopEvent(evt);
			});
			dojo.connect(window, 'drop', function(evt) {
				dojo.stopEvent(evt);
			});
			dojo.connect(this.dropTarget, 'dragenter', function() {
				dojo.addClass(this, 'targetActive');
			});
			dojo.connect(this.dropTarget, 'dragleave', function(evt) {
				dojo.removeClass(this, 'targetActive');
			});
			dojo.connect(this.dropTarget, 'mouseout', function(evt) {
				dojo.removeClass(this, 'targetActive');
			});
			dojo.connect(this.dropTarget, 'drop', this, function(evt) {
				var files = evt.dataTransfer.files;
				this.reset();
				this.addFiles(files);
				dojo.removeClass(this.dropTarget, 'targetActive');
         });
		}
	},

	/**
	 * Add and filter files to upload.
	 * Add files to internal array and calc total amount of bytes to upload. Also check for size and number of uploads limit.
	 * @param {Array} files instance of FileList object
	 */
	addFiles: function(files) {
		var dfds = [], idx;
		dfds[0] = new dojo.Deferred();
		dfds[0].resolve(false);

		// exclude files that are to large
		// and chain deferreds so the get fired one after the other
		this.files = dojo.filter(files, function(file) {
			idx = dfds.length - 1;
			var self = this;
			if (file.size > this.maxKBytes) {
				dfds[idx + 1] = dfds[idx].then(function(remember) {
					if (!remember) {
						return files.length > 1 ? self.confirmFileSize(file.fileName) : self.confirmFileSizeSingle(file.fileName);
					}
					else {
						var dfd = new dojo.Deferred();
						dfd.resolve(true);
						return dfd;
					}
				});
				return false;
			}
			else {
				this.bytesOverall += file.size;
				return true;
			}
		}, this);

		// limit number of files you can upload
		if (this.files.length > this.maxNumFiles) {
			this.files = this.files.slice(0, this.maxNumFiles);
			idx = dfds.length - 1;
			dfds[idx + 1] = dfds[idx].then(dojo.hitch(this, function() {
				return this.confirmNumFileLimit(this.maxNumFiles);
			}));
		}

		dfds[dfds.length - 1].then(dojo.hitch(this, function() {
			this.createBars();
			this.uploadFiles();
			dfds = null;   // free memory
		}));
	},

	/**
	 * Creates a progress bar for each file and uploads it.
	 */
	createBars: function() {
		var self = this;
		var container, div, strTemplate;
		var barOverall = this.barOverall;
		var i = 0, len = this.files.length;
		if (len === 0) {
			return false;
		}

		// create fileUploader container
		strTemplate = '<div id="pbwOverallCont">' +
			'<div id="pbwBarOverall" class="pbwBar">' +
				'<div class="pbwTxt">overall progress</div>' +
			'</div>' +
			'</div>' +
			'<div id="pbwBarsCont"></div>';

		// display inside dialog pane
		if (!this.displayTarget) {
			container = new dijit.Dialog({
				id: 'snetUploader',
				title: 'Uploader by www.speich.net',
				content: strTemplate,
				duration: 500,
				onHide: function() {
					window.setTimeout(function() {
						container.destroyRecursive();
					}, container.get('duration') + 20);
				}
			});
			container.show();
		}
		// display inside target element
		else {
			container = dojo.create('div', {
				id: 'snetUploader',
				innerHTML: strTemplate
			}, this.displayTarget)
		}

		// create progress bar for overall progress
		div = dojo.create('div', {}, 'pbwBarOverall');
		barOverall = new dijit.ProgressBar({
			maximum: this.bytesOverall,
			progress: 0
		}, div);

		// create containers for individual progress bars
		for (; i < len; i++) {
			(function(i) {
				var bar, file = self.files[i];
				div = dojo.create('div', {}, 'pbwBarsCont');
				bar = new snet.fileUploader.ProgressBar({
					label: file.name + ', ' + self.formatSize(file.size),
					bytesTotal: file.size,
					maximum: file.size,
					progress: 0
				}, div);
				bar.setIcon(file, 64);
				dojo.connect(bar, 'onBeforeUpdate', function(props) {
					var inc = props.progress - this.progress;
					barOverall.update({
						progress: barOverall.progress + inc
					});
				});
				dojo.connect(bar, 'onComplete', function() {
					var stat = self.fileStatus;
					stat.numCompleted++;
					if (stat.numCompleted + stat.numAborted === len) {
						dojo.addClass(dojo.query('.dijitProgressBarTile', barOverall.domNode)[0], 'pbwBarTileDone');
						barOverall.update({
							indeterminate: false,
							progress: barOverall.maximum
						});
					}
				});
				dojo.connect(bar, 'onRetry', function() {
					self.resume(file, this);
				});
				dojo.connect(bar, 'onResume', function() {
					self.resume(file, this);
				});
				dojo.connect(bar, 'onPause', function() {
					if (bar.xhr) {
						bar.xhr.abort();
					}
				});
				dojo.connect(bar, 'onDelete', function() {
					var dfd = self.del(file, bar);
					dfd.then(function() {
						self.progressBars[i] = null;
						self.files[i] = null;
						self.remove(container);
					});
				});
				dojo.connect(bar, 'onAbort', function() {
					// we can't just use bar.xhr.abort(); since part of the file will still be written to disk on server
					// => init abort on server first
					self.abort(file, bar);
					self.progressBars[i] = null;
					self.files[i] = null;
				});
				dojo.connect(bar, 'onRemove', function() {
					self.remove(container);
				});
				self.progressBars[i] = bar;
			})(i);
		}
		this.barOverall = barOverall;
	},

	/**
	 * Shows a dialog to confirm skipping files that are to big.
	 * @param {String} fileName name of file
	 * @return {dojo.Deferred}
	 */
	confirmFileSize: function(fileName) {
		var dialog = new snet.DialogConfirm({
			title: 'Confirm',
			content: '<p>Maximum file size is limited to ' + this.formatSize(this.maxKBytes) + '.</p>' +
				'<p>Press \'OK\' to skip file ' + fileName + '<br/>or press \'Cancel\' to cancel uploading.</p>',
			onHide: function() {
				this.destroyRecursive();
			}
		});
		return dialog.show();
	},

	/**
	 * Shows a dialog to confirm not uploading file that is to big (only one file overall).
	 * Used only when there is a single file to upload.
	 * @param {String} fileName name of file
	 * @return {dojo.Deferred}
	 */
	confirmFileSizeSingle: function(fileName) {
		var dialog = new snet.DialogConfirm({
			title: 'Confirm',
			content: 'Maximum file size is limited to ' + this.formatSize(this.maxKBytes) + '. Uploading file ' +
				fileName + ' will be canceled.</p>',
			hasCancelButton: false,
			hasSkipCheckBox: false,
			onHide: function() {
				this.destroyRecursive();
			}
		});
		return dialog.show();
	},

	/**
	 * Shows a dialog to confirm skipping the remaining files.
	 * If the limit of number of files that can be uploaded is reached, the user can decide to skip the remaining files.
	 * @param {number} limit maximum number of files that can be uploaded
	 * @return {dojo.Deferred}
	 */
	confirmNumFileLimit: function(limit) {
		var dialog = new snet.DialogConfirm({
			title: 'Confirm',
			content: '<p>Maximum number of files to upload is limited to ' + limit + '.</p>' +
				'<p>Press \'OK\' to upload only the first ' + limit + ' files<br/>or press \'Cancel\' to cancel uploading.</p>',
			hasSkipCheckBox: false,
			onHide: function() {
				this.destroyRecursive();
			}
		});
		return dialog.show();
	},

	/**
	 * Displays a dialog to confirm deleting a file.
	 * @param {string} fileName name of file to delete
	 * @return {dojo.Deferred}
	 */
	confirmDelete: function(fileName) {
		var dialog = new snet.DialogConfirm({
			title: 'Delete',
			content: '<p>Do you want to delete the uploaded file ' + fileName + ' on the remote server?</p>' +
				'<p>Press \'OK\' to delete<br/>or press \'Cancel\' to cancel.</p>',
			hasSkipCheckBox: true,
			onHide: function() {
				this.destroyRecursive();
			}
		});
		return dialog.show();
	},

	/**
	 * Displays a dialog to confirm that current browser is not supported.
	 * @return {dojo.Deferred}
	 */
	confirmHasFeatures: function() {
		var dialog = new snet.DialogConfirm({
			title: 'Wrong browser',
			hasCancelButton: false,
			hasSkipCheckBox: false,
			content: '<p>Your browser doesn\'t support HTML5 multiple drag and drop upload. Consider downloading Mozilla Firefox.</p>',
			onHide: function() {
				this.destroyRecursive();
			}
		});
		return dialog.show();
	},

	/**
	 * Removes the overall bar.
	 */
	remove: function(container) {
		var someLeft = dojo.some(this.files, function(item) {
			return item !== null;
		});
		if (!someLeft) {
			window.setTimeout(function() {   // TODO: check if this is really necessary
				// since we might be in progress of already hiding another dialog
				container.hide();
			}, container.get('duration') + 20)
		}
	},

	/**
	 * Upload all dropped files that don't exceed size and number of files limit.
	 */
	uploadFiles: function() {
		var i = 0, len = this.files.length;
		for (; i < len; i++) {
		//	this.saveToDb(this.files[i]);
			this.upload(this.files[i], this.progressBars[i]);
		}
		dojo.subscribe('upload/progress/done', this, function() {
			var stat = this.fileStatus;
			stat.numProgressDone++;
			if (stat.numProgressDone + stat.numAborted === len) {
				this.barOverall.update({
					indeterminate: true
				});
			}
		});
	},

	/**
	 * Upload file via XmlHttpRequest.
	 * Reads file into binary string and uploads it while displays its progress.
	 * @param {File} file file to upload
	 * @param {snet.fileUploader.ProgressBar} bar progress bar
	 */
	upload: function(file, bar) {
		// Use native XMLHttpRequest instead of XhrGet since dojo 1.5 does not allow to send binary data as per docs
		var req = bar.xhr = new XMLHttpRequest();
		var dfd = this.setReadyStateChangeEvent(req, bar);
		this.setProgressEvent(req, bar);
		bar.upload();
		req.open('post', this.url + '?fnc=upl', true);
		req.setRequestHeader("Cache-Control", "no-cache");
		req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
		req.setRequestHeader("X-File-Name", file.name);
		req.setRequestHeader("X-File-Size", file.size);
//		req.setRequestHeader("Content-Type", "application/octet-stream");
		req.send(file);
		return dfd;
	},

	/**
	 * Displays upload status and errors.
	 * @param {XMLHttpRequest} req
	 * @param {snet.fileUploader.ProgressBar} bar
	 */
	setReadyStateChangeEvent: function(req, bar) {
		var dfd = new dojo.Deferred();
		dojo.connect(req, 'readystatechange', this, function() {
			var err = null;
			if (req.readyState == 4) {
				// upload finished successful
				if (req.status == 200 || req.status == 201) {
					window.setTimeout(function() {
						bar.complete();
						dfd.resolve();
					}, 500);
				}
				else {
					// server error or user aborted (canceled)
 					if (req.status === 0 && (bar.aborted || bar.paused)) {
						// User canceled or paused upload. Not an error.
						dfd.resolve();
					}
					else {
					   err = {
							statusCode: req.status,
							statusText: req.statusText,
							responseText: req.responseText
						};
						if (req.statusText == '') {
							err.responseText = 'Unknown error.';
						}
						bar.error(err);
						dfd.reject();
						this.fileStatus.numError++;
					}
				}
				req = null;
				bar.xhr = null;
			}
		});
		return dfd;
	},

	/**
	 * Setup the progress event to display upload progress.
	 * @param {XMLHttpRequest} req
	 * @param {snet.fileUploader.ProgressBar} bar
	 * @param {number} [resumeStart]
	 */
	setProgressEvent: function(req, bar, resumeStart) {
		dojo.connect(req.upload, 'progress', function(evt) {
			var loaded = evt.loaded + (resumeStart || 0);
			if (evt.lengthComputable) {
				//var num = Math.round((evt.total - loaded) / evt.total * 1000);
				var num = Math.round(loaded / evt.total * 100); // find better measure, see below
				bar.update({
					progress: loaded
				});
				if (num == 100 && (!arguments.callee.done === true)) {   // make sure this only gets called once per bar
					// TODO: find better ways to decide when we switch to indeterminate
					// in FF4 never evt.loaded == bar.maximum, but in chrome
					arguments.callee.done = true;
					bar.wait();  // upload is complete but file has not been written to disk, waits for status 200
					dojo.publish('upload/progress/done', [bar]); // notify barOverall so it can be set to indeterminate
				}
			}
		});
	},

	/**
	 * Sends request to delete file on remote server.
	 * @param {string} fileName name of file to delete
	 * @param {snet.fileUploader.ProgressBar} bar
	 * @return {dojo.Deferred}
	 */
	deleteFile: function(fileName, bar) {
		return dojo.xhrGet({
			url: this.url,
			content: {
				fnc: 'del',
				fileName: fileName
			},
			failOk: true,
			error: function(err, ioArgs) {
				bar.error({
					statusCode: ioArgs.xhr.status,
					statusText: ioArgs.xhr.statusText,
					responseText: err.responseText
				});
			}
		});
	},

	/**
	 * Deletes the uploaded file and removes the bar from the list.
	 * @param {File} file
	 * @param {snet.fileUploader.ProgressBar} bar
	 */
	del: function(file, bar) {
		var self = this;
		var dfd = new dojo.Deferred();
		dfd.resolve(self.rememberConfirmDelete);
		dfd = dfd.then(function(remember) {
			if (remember === false) {
				return self.confirmDelete(file.fileName);
			}
		}).then(function(remember) {
			self.rememberConfirmDelete = remember;
			return self.deleteFile(file.fileName, bar);
		}).then(function() {
			bar.remove();
		});
		return dfd;
	},

	/**
	 * Aborts the upload.
	 * @param {File} file
	 * @param {snet.fileUploader.ProgressBar} bar
	 */
	abort: function(file, bar) {
		if (bar.xhr) {
			bar.xhr.abort();
		}
		this.fileStatus.numAborted++;
		var inc = bar.maximum - bar.progress;
		this.barOverall.update({
			progress: this.barOverall.progress + inc
		});
		window.setTimeout(dojo.hitch(this, function() {
			// after aborting some bytes of the file might still be written to the disk on the server,
			// Unfortunately the delete request cant be sent right away, since there is some lag on the server
			// (file is not written yet)  and the delete would create a 404.
			// Ugly,  but I just do a the best guess of a 2sec delay to send the delete
			this.deleteFile(file.fileName, bar);
		}), 2000);
		bar.xhr = null;
		bar = null;
	},

	resume: function(file, bar) {
		// Since we do not write anything to disk in this demo, we can't check the size of the partially written file
		// on the server before continuing, instead we just use the local progress (which of course is not reliable, since
		// we do not know how much was still sent and saved on the server -> in a realworld app use the extra xhr to server)
		var dfd = null;

		if (!this.hasBlobSliceSupport(file)) {
			var dialog = new dijit.DialogConfirm({
				title: 'Wrong browser',
				hasCancelButton: false,
				hasSkipCheckBox: false,
				content: '<p>Your browser does not support resuming uploads.</p>',
				onHide: function() {
					this.destroyRecursive();
				}
			});
			dialog.show();
		}

		dojo.byId(bar.id + '_msg').innerHTML = 'Resuming...';

		// Get number of bytes from server which have already been written to the server
		// This is not possible in demo, since nothing has been written to disk, server will just send nada
		dfd = dojo.xhrGet({
			url: this.url,
			handleAs: 'json',
			content: {
				fnc: 'getNumWrittenBytes',
				fileName: file.name
			},
			failOk: true,
			error: function(err, ioArgs) {
				bar.error({
					statusCode: ioArgs.xhr.status,
					statusText: ioArgs.xhr.statusText,
					responseText: err.responseText
				});
			}
		});

		dfd.then(dojo.hitch(this, function(result) {
			var dfd = new dojo.Deferred();
			var start = (result && result.numWritten) || bar.progress; // bar.progress for demo only
			var length = file.size - start;
			var chunk = file.slice(start, length);
			var req = bar.xhr = new XMLHttpRequest();
			dfd = this.setReadyStateChangeEvent(req, bar);
			this.setProgressEvent(req, bar, start);
			bar.upload();
			req.open('post', this.url + '?fnc=resume', true);
			req.setRequestHeader("Cache-Control", "no-cache");
			req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
			req.setRequestHeader("X-File-Name", file.name);
			req.setRequestHeader("X-File-Size", file.size);
			req.send(chunk);
			return dfd;
		}));
		return dfd;
	},

	/**
	 * Resets the fileUploader.
	 */
	reset: function() {
		this.bytesOverall = 0;
		this.barOverall = null;
		this.fileStatus =  {
			numCompleted: 0,
			numAborted: 0,
			numProgressDone: 0,
			numError: 0
		};
		this.files = [];
		this.progressBars = [];
	},

	/**
	 * Format file size.
	 * @param {Number} bytes
	 */
	formatSize: function(bytes) {
		var str = ['bytes', 'kb', 'MB', 'GB', 'TB', 'PB'];
		var num = Math.floor(Math.log(bytes)/Math.log(1024));
		bytes = bytes === 0 ? 0 : (bytes / Math.pow(1024, Math.floor(num))).toFixed(1) + ' ' + str[num];
		return bytes;
	},

	hasFeatures: function() {
		var supported;
		supported = this.hasDnDSupport();
		supported = this.hasFileAPISupport();
		supported = this.hasUploadSupport();
		return supported;
	},

	hasUploadSupport: function() {
		// taken from has.js
		return 'withCredentials' in new XMLHttpRequest && 'upload' in new XMLHttpRequest;
	},

	hasFileAPISupport: function() {
		// taken from has.js
		return typeof FileReader != 'undefined';
	},

	hasBlobSliceSupport: function(file) {
		// file.slice is not supported by FF3.6
		return 'slice' in file;
	},

  	hasDnDSupport: function() {
		// taken from has.js
		return 'draggable' in document.createElement('span');
	}

});

