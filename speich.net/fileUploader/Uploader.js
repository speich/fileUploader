define([
	'dojo/_base/lang',
	'dojo/_base/declare',
	'dojo/_base/Deferred',
	'dojo/_base/array',
	'dojo/_base/xhr',
	'dojo/dom',
	'dojo/dom-construct',
	'dojo/dom-class',
	'dojo/query',
	'dojo/has',
	'dojo/on',
	'dojo/aspect',
	'dijit/registry',
	'dijit/Dialog',
	'snet/DialogConfirm',
	'dijit/ProgressBar',
	'snet/fileUploader/ProgressBar'
], function(lang, declare, Deferred, array, xhr, dom, domConstruct, domClass, query, has, on, aspect, registry, Dialog, DialogConfirm, ProgressBar, UploadProgressBar) {

	return declare(null, {

		maxKBytes: 3000, // in kbytes limited by php.ini directive upload_max_filesize
		maxNumFiles: 10, // limited by php.ini directive max_file_uploads
		bytesOverall: 0,
		barOverall: null,
		fileStatus: {
			numCompleted: 0, // number of completely uploaded files
			numAborted: 0, // number of canceled files
			numProgressDone: 0, // number of files where upload progress is 100%
			numError: 0			 // number of files with error
		},
		files: [], // files that will be uploaded after checking their length and max allowed number of uploads
		progressBars: [], // keeps track of created bars
		displayTarget: null, // If null, progress is displayed in a dialog, otherwise provide element id
		dropTarget: null,
		rememberConfirmDelete: false, // do not ask user again to confirm deleting

		/**
		 * Instantiates the fileUploader.
		 * Expects object with following properties:
		 *	 id:		// {String|Object} DomNode or id of element that the progress bars are created in.
		 *	 url:	  // {String} url of php page that handles the upload
		 *	 target:  // {String|Object} DomNode or id of element where files can be dropped onto
		 *
		 * @param {Object} props arguments
		 */
		constructor: function(props) {
			if (!this.hasFeatures()) {
				this.confirmHasFeatures();
			}
			else {
				props.dropTarget = dom.byId(props.dropTarget);
				lang.mixin(this, props);
				this.maxKBytes *= 1048;    // e.g. * (1024 + 24)

				// add drag and drop events
				on(window, 'dragover', function(evt) {
					evt.preventDefault();	// necessary for dnd to work
				});
				on(window, 'drop', function(evt) {
					evt.preventDefault();
				});
				on(this.dropTarget, 'dragenter', function() {
					domClass.add(this, 'targetActive');
				});
				on(this.dropTarget, 'dragleave', function() {
					domClass.remove(this, 'targetActive');
				});
				on(this.dropTarget, 'mouseout', function() {
					domClass.remove(this, 'targetActive');
				});
				on(this.dropTarget, 'drop', lang.hitch(this, function(evt) {
					var files = evt.dataTransfer.files;
					this.reset();
					this.addFiles(files);
					domClass.remove(this.dropTarget, 'targetActive');
				}));
			}
		},

		/**
		 * Add and filter files to upload.
		 * Add files to internal array and calc total amount of bytes to upload. Also check for size and number of uploads limit.
		 * @param {Array} files instance of FileList object
		 */
		addFiles: function(files) {
			var dfds = [], idx;
			dfds[0] = new Deferred();
			dfds[0].resolve(false);

			// exclude files that are to large
			// and chain deferreds so the get fired one after the other
			this.files = array.filter(files, function(file) {
				idx = dfds.length - 1;
				var self = this;
				if (file.size > this.maxKBytes) {
					dfds[idx + 1] = dfds[idx].then(function(remember) {
						var fileName = file.name || file.fileName;
						if (!remember) {
							return files.length > 1 ? self.confirmFileSize(fileName) : self.confirmFileSizeSingle(fileName);
						}
						else {
							var dfd = new Deferred();
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
				dfds[idx + 1] = dfds[idx].then(lang.hitch(this, function() {
					return this.confirmNumFileLimit(this.maxNumFiles);
				}));
			}

			dfds[dfds.length - 1].then(lang.hitch(this, function() {
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
				container = new Dialog({
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
				container = domConstruct.create('div', {
					id: 'snetUploader',
					innerHTML: strTemplate
				}, this.displayTarget)
			}

			// create progress bar for overall progress
			div = domConstruct.create('div', null, 'pbwBarOverall');
			barOverall = new ProgressBar({
				maximum: this.bytesOverall,
				value: 0
			}, div);

			// create containers for individual progress bars
			for (; i < len; i++) {
				(function(i) {
					var bar, file = self.files[i];
					div = domConstruct.create('div', null, 'pbwBarsCont');

					bar = new UploadProgressBar({
						text: file.name + ', ' + self.formatSize(file.size),
						bytesTotal: file.size,
						maximum: file.size,
						value: 0
					}, div);
					bar.setIcon(file, 64);
					bar.watch('value', function(valName, valOld, valNew) {
						var stat, inc;
						if (valNew != Infinity && valOld != Infinity) {
							inc = valNew - valOld + barOverall.get('value');
							barOverall.set('value', inc);
						}
						else if (valNew == Infinity) {
							stat = self.fileStatus;
							stat.numProgressDone++;
							if (stat.numProgressDone + stat.numAborted === len) {
								barOverall.set('value', Infinity);
							}
						}
					});
					aspect.after(bar, 'onComplete', function() {
						// todo: use bar.watch instead as above
						var stat = self.fileStatus;
						stat.numCompleted++;
						if (stat.numCompleted + stat.numAborted === len) {
							domClass.add(query('.dijitProgressBarTile', barOverall.domNode)[0], 'pbwBarTileDone');
							barOverall.set('value', barOverall.maximum);
						}
					});
					aspect.after(bar, 'onRetry', function() {
						self.resume(file, this);
					});
					aspect.after(bar, 'onResume', function() {
						self.resume(file, this);
					});
					aspect.after(bar, 'onPause', function() {
						if (bar.xhr) {
							bar.xhr.abort();
						}
					});
					aspect.after(bar, 'onDelete', function() {
						var dfd = self.del(file, bar);
						dfd.then(function() {
							self.progressBars[i] = null;
							self.files[i] = null;
							self.remove(container);
						});
					});
					aspect.after(bar, 'onAbort', function() {
						// we can't just use bar.xhr.abort(); since part of the file will still be written to disk on server
						// => init abort on server first
						self.abort(file, bar);
						self.progressBars[i] = null;
						self.files[i] = null;
					});
					aspect.after(bar, 'onRemove', function() {
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
		 * @return {dojo/_base/Deferred}
		 */
		confirmFileSize: function(fileName) {
			var dialog = registry.byId('dialogFileSize') || new DialogConfirm({
				id: 'dialogFileSize',
				title: 'Confirm',
				content: '<p>Maximum file size is limited to ' + this.formatSize(this.maxKBytes) + '.</p>' +
				'<p>Press \'OK\' to skip file ' + fileName + '<br/>or press \'Cancel\' to cancel uploading.</p>'
			});
			return dialog.show();
		},

		/**
		 * Shows a dialog to confirm not uploading file that is to big (only one file overall).
		 * Used only when there is a single file to upload.
		 * @param {String} fileName name of file
		 * @return {dojo/_base/Deferred}
		 */
		confirmFileSizeSingle: function(fileName) {
			var dialog = registry.byId('dialogFileSizeSingle') || new DialogConfirm({
				id: 'dialogFileSizeSingle',
				title: 'Confirm',
				content: 'Maximum file size is limited to ' + this.formatSize(this.maxKBytes) + '. Uploading file ' +
				fileName + ' will be canceled.</p>',
				hasCancelButton: false,
				hasSkipCheckBox: false
			});
			return dialog.show();
		},

		/**
		 * Shows a dialog to confirm skipping the remaining files.
		 * If the limit of number of files that can be uploaded is reached, the user can decide to skip the remaining files.
		 * @param {number} limit maximum number of files that can be uploaded
		 * @return {dojo/_base/Deferred}
		 */
		confirmNumFileLimit: function(limit) {
			var dialog = registry.byId('dialogNumFileLimit') || new DialogConfirm({
				id: 'dialogNumFileLimit',
				title: 'Confirm',
				content: '<p>Maximum number of files to upload is limited to ' + limit + '.</p>' +
				'<p>Press \'OK\' to upload only the first ' + limit + ' files<br/>or press \'Cancel\' to cancel uploading.</p>',
				hasSkipCheckBox: false
			});
			return dialog.show();
		},

		/**
		 * Displays a dialog to confirm deleting a file.
		 * @param {string} fileName name of file to delete
		 * @return {dojo/_base/Deferred}
		 */
		confirmDelete: function(fileName) {
			var dialog = registry.byId('dialogDelete') || new DialogConfirm({
				id: 'dialogDelete',
				title: 'Delete',
				content: '<p>Do you want to delete the uploaded file ' + fileName + ' on the remote server?</p>' +
				'<p>Press \'OK\' to delete<br/>or press \'Cancel\' to cancel.</p>',
				hasSkipCheckBox: true
			});
			return dialog.show();
		},

		/**
		 * Displays a dialog to confirm that current browser is not supported.
		 * @return {dojo/_base/Deferred}
		 */
		confirmHasFeatures: function() {
			var dialog = registry.byId('dialogHasFeatures') || new DialogConfirm({
				id: 'dialogHasFeatures',
				title: 'Wrong browser',
				hasCancelButton: false,
				hasSkipCheckBox: false,
				content: '<p>Your browser doesn\'t support HTML5 multiple drag and drop upload. Consider downloading Mozilla Firefox.</p>'
			});
			return dialog.show();
		},

		/**
		 * Removes the overall bar.
		 */
		remove: function(container) {
			var someLeft = array.some(this.files, function(item) {
				return item !== null;
			});
			if (!someLeft) {
				window.setTimeout(function() {	// TODO: check if this is really necessary
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
			req.send(file);
			return dfd;
		},

		/**
		 * Displays upload status and errors.
		 * @param {XMLHttpRequest} req
		 * @param {snet.fileUploader.ProgressBar} bar
		 */
		setReadyStateChangeEvent: function(req, bar) {
			var dfd = new Deferred();
			on(req, 'readystatechange', lang.hitch(this, function() {
				var err = null;
				if (req.readyState == 4) {
					// upload finished successful
					if (req.status == 200 || req.status == 201) {
						//window.setTimeout(function() {
						bar.complete();
						dfd.resolve();
						//}, 500);
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
			}));
			return dfd;
		},

		/**
		 * Setup the progress event to display upload progress.
		 * @param {XMLHttpRequest} req
		 * @param {snet/fileUploader/ProgressBar} bar
		 * @param {number} [resumeStart]
		 */
		setProgressEvent: function(req, bar, resumeStart) {
			var cnn = on(req.upload, 'progress', function(evt) {
				var loaded = evt.loaded + (resumeStart || 0);
				if (evt.lengthComputable) {
					//var num = Math.round((evt.total - loaded) / evt.total * 1000);
					var num = Math.round(loaded / evt.total * 100); // find better measure, see below
					bar.set('value', loaded);
					if (num == 100 && (!arguments.callee.done === true)) {
						// TODO: find better ways to decide when we switch to indeterminate
						// in FF4 never evt.loaded == bar.maximum, but in chrome
						// see https://bugzilla.mozilla.org/show_bug.cgi?id=637002
						arguments.callee.done = true;
						cnn.remove(); // make sure this only gets called once per bar after upload is completed
						bar.wait();  // upload is complete but file has not been written to disk, waits for status 200
					}
				}
			});
		},

		/**
		 * Sends request to delete file on remote server.
		 * @param {string} fileName name of file to delete
		 * @param {snet/fileUploader/ProgressBar} bar
		 * @return {dojo/_base/Deferred}
		 */
		deleteFile: function(fileName, bar) {
			return xhr.get({
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
			var dfd = new Deferred();
			var fileName = file.name || file.fileName;
			dfd.resolve(self.rememberConfirmDelete);
			dfd = dfd.then(
			function(remember) {
				if (remember === false) {
					return self.confirmDelete(fileName);
				}
			}).then(
			function(remember) {
				self.rememberConfirmDelete = remember;
				return self.deleteFile(fileName, bar);
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
			var inc = bar.maximum - bar.value;
			this.barOverall.set('value', this.barOverall.value + inc);
			window.setTimeout(lang.hitch(this, function() {
				// after aborting some bytes of the file might still be written to the disk on the server,
				// Unfortunately the delete request cant be sent right away, since there is some lag on the server
				// (file is not written yet) and the delete would create a 404.
				// Ugly, but I just do a the best guess of a 2sec delay to send the delete
				this.deleteFile(file.name || file.fileName, bar);
				bar.xhr = null;
				bar = null;
			}), 2000);
		},

		resume: function(file, bar) {
			// Since we do not write anything to disk in this demo, we can't check the size of the partially written file
			// on the server before continuing, instead we just use the local progress (which of course is not reliable, since
			// we do not know how much was still sent and saved on the server -> in a realworld app use the extra xhr to server)
			var dfd = null;

			if (!this.hasBlobSliceSupport(file)) {
				var dialog = registry.byId('dialogHasBlobSliceSupport') || new DialogConfirm({
					id: 'dialogHasBlobSliceSupport',
					title: 'Wrong browser',
					hasCancelButton: false,
					hasSkipCheckBox: false,
					content: '<p>Your browser does not support resuming uploads.</p>'
				});
				dialog.show();
			}

			dom.byId(bar.id + '_msg').innerHTML = 'Resuming...';

			// Get number of bytes from server which have already been written to the server
			// This is not possible in demo, since nothing has been written to disk, server will just send nada
			dfd = xhr.get({
				url: this.url,
				handleAs: 'json',
				content: {
					fnc: 'getNumWrittenBytes',
					fileName: file.name || file.fileName
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

			dfd.then(lang.hitch(this, function(result) {
				// Blob.slice is temporarily prefixed in Firefox now, because of changed syntax from start, length to start, end
				var dfd, chunk;
				var start = (result && result.numWritten) || bar.value; // bar.value for demo only
				var length = file.size - start;
				var req = bar.xhr = new XMLHttpRequest();
				if ('mozSlice' in file) {
					chunk = file.mozSlice(start, file.size);  // new parameters start, end instead of length
				}
				else {
					chunk = file.slice(start, length);
				}
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
			this.fileStatus = {
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
			var num = Math.floor(Math.log(bytes) / Math.log(1024));
			bytes = bytes === 0 ? 0 : (bytes / Math.pow(1024, Math.floor(num))).toFixed(1) + ' ' + str[num];
			return bytes;
		},

		/**
		 * Check if browser supports necessary features for the uploader to work.
		 */
		hasFeatures: function() {
			// test taken from has.js
			if (has.add('dnd', function(global, document, anElement) {
				return 'draggable' in document.createElement('span');
			}, true) && has.add('file-api', function(global, document, anElement) {
				return typeof FileReader != 'undefined';
			}, true) && has.add('native-xhr-uploadevents', function(global, document, anElement) {
				return has("native-xhr") && ("upload" in new XMLHttpRequest);
			}, true)) {
				return true
			}
			else {
				return false;
			}
		},

		hasBlobSliceSupport: function(file) {
			// file.slice is not supported by FF3.6 and is prefixed in FF5 now
			return ('slice' in file || 'mozSlice' in file);
		}

	});
});
