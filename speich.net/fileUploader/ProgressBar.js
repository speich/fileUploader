define([
	'dojo/_base/kernel',
	'dojo/_base/lang',
	'dojo/_base/declare',
	'dojo/_base/Deferred',
	'dojo/_base/fx',
	'dojo/dom',
	'dojo/dom-construct',
	'dojo/dom-class',
	'dojo/dom-style',
	'dojo/query',
	'dojo/on',
	'dijit/ProgressBar',
	'dijit/_TemplatedMixin',
	'dojo/text!dijit/templates/ProgressBar.html'
], function(kernel, lang, declare, Deferred, fx, dom, domConstruct, domClass, domStyle, query, on, ProgressBar, _TemplatedMixin, template) {

	return declare('snet.fileUploader.ProgressBar', [ProgressBar,  _TemplatedMixin], {

		aborted: false, // user aborted upload
		paused: false,
		statics: {id: 0}, // static variable to create unique widget id, if none is provided
		text: '',
		xhr: null, // reference to XmlHttpRequest object

		templateString: '<div class="pbwBar">' +
			'<div id="${id}_thumb" class="pbwThumb"></div>' +
			'<div class="pbwBarContRight">' +
			'<div id="${id}_text" class="pbwTxt data-dojo-attach-point="text">${text}</div>' + template +
			'<div id="${id}_msg" class="pbwMsg"></div>' +
			'<div id="${id}_errMsg" class="pbwMsg"></div>' +
			'<div id="${id}_abort" class="pbwButton">abort</div>' +
			'<div id="${id}_pause" class="pbwButton">pause</div>' +
			'<div id="${id}_resume" class="pbwButton">resume</div>' +
			'<div id="${id}_retry" class="pbwButton">retry</div>' +
			'<div id="${id}_del" class="pbwButton">delete</div>' +
			'<div id="${id}_remove" class="pbwButton">remove</div>' +
			'</div>' +
			'</div>',

		/**
		 * Instantiates the progress bar.
		 * @param {object} props
		 */
		constructor: function(props) {
			lang.mixin(this, props);
		},

		/**
		 * Setup the bar's button/link events.
		 */
		postCreate: function() {
			on(dom.byId(this.id + '_abort'), 'click', lang.hitch(this, this.abort));
			on(dom.byId(this.id + '_retry'), 'click', lang.hitch(this, this.retry));
			on(dom.byId(this.id + '_del'), 'click', lang.hitch(this, this.del));
			on(dom.byId(this.id + '_pause'), 'click', lang.hitch(this, this.pause));
			on(dom.byId(this.id + '_resume'), 'click', lang.hitch(this, this.resume));
			on(dom.byId(this.id + '_remove'), 'click', lang.hitch(this, this.remove));
		},

		/**
		 * Create and display an icon for the file.
		 * @param {File} file
		 * @param {number} newWidth width of icon
		 * @return {dojo/_base/Deferred}
		 */
		setIcon: function(file, newWidth) {
			var img = new Image();
			var newHeight;
			var fileType = file.type.toLowerCase();
			var el = dom.byId(this.id + '_thumb');
			var dfd = new Deferred();

			if (fileType.match(/image\/*/)) {
				newWidth = newWidth - 8;  // 2 x 4px from css border
				if (fileType.match(/image\/(jpg|gif|png|jpeg)/)) {
					dfd = this.createThumb(file, newWidth);
				}
				else {
					img.src = kernel.moduleUrl('snet') + 'fileUploader/resources/mallard.png';
					img.onload = function() {	 // resize to fit icon
						newHeight = Math.floor(img.height * newWidth / img.width);
						img.width = newWidth;
						img.height = newHeight;
						dfd.resolve(img);
					}
				}
				dfd.then(function(img) {
					var div = domConstruct.create('div', {
						'class': 'pbwThumbCanvas',
						style: {
							opacity: 0,
							backgroundImage: 'url(' + img.src + ') ',
							backgroundSize: img.width + 'px ' + img.height + 'px'
						},
						innerHTML: '<img src="' + img.src + '" style="visibility: hidden" width="' + img.width + '" height="' + img.height + '"/>'
					}, el);
					fx.fadeIn({
						node: div,
						duration: 500
					}).play();
					return img;
				});
			}
			else {
				if (fileType.match(/video\/*/)) {
					img.src = kernel.moduleUrl('snet') + 'fileUploader/resources/icons-64/file-video.png'
				}
				else if (fileType.match(/audio\/*/)) {
					img.src = kernel.moduleUrl('snet') + 'fileUploader/resources/icons-64/file-audio.png'
				}
				else if (fileType.match(/text\/*/)) {
					img.src = kernel.moduleUrl('snet') + 'fileUploader/resources/icons-64/file-text.png'
				}
				else {
					img.src = kernel.moduleUrl('snet') + 'fileUploader/resources/icons-64/file.png'
				}
				domConstruct.place(img, el, 'first');
				dfd.resolve(img);
			}
			return dfd;
		},

		/**
		 * Creates a thumbnail from the provided image file.
		 * Returns a Deferred which resolves to an image.
		 * @param {File} file
		 * @param {number} newWidth width of thumbnail
		 * @return {dojo/_base/Deferred}
		 */
		createThumb: function(file, newWidth) {
			var dfd = new Deferred();
			var reader = new FileReader();
			reader.onload = function(evt) {
				var img = new Image();
				img.src = evt.target.result;
				img.onload = function() {
					var newHeight = Math.floor(img.height * newWidth / img.width);
					var canvas = domConstruct.create('canvas', {
						width: newWidth,
						height: newHeight
					});
					canvas.getContext('2d').drawImage(img, 0, 0, newWidth, newHeight);
					img.src = canvas.toDataURL();
					img.onload = function() {
						dfd.resolve(img);
					}
				}
			};
			reader.readAsDataURL(file);
			return dfd;
		},

		setLabel: function(text) {
			this.label.firstChild.nodeValue = text;
		},

		/**
		 * Sets the bar into one of its states.
		 * @param {string} state
		 */
		setState: function(state) {
			// reset to default
			var cssClasses = ['pbwBarTileError', 'pbwBarTileAborted', 'pbwBarTileDone'];
			domClass.remove(query('.dijitProgressBarTile', this.domNode)[0], cssClasses);
			domStyle.set(this.id + '_abort', 'display', 'none');
			domStyle.set(this.id + '_errMsg', 'display', 'none');
			domStyle.set(this.id + '_retry', 'display', 'none');
			domStyle.set(this.id + '_del', 'display', 'none');
			domStyle.set(this.id + '_pause', 'display', 'none');
			domStyle.set(this.id + '_resume', 'display', 'none');

			switch (state) {
				case 'completed':
					domClass.add(query('.dijitProgressBarTile', this.domNode)[0], 'pbwBarTileDone');
					domStyle.set(this.id + '_del', 'display', 'inline-block');
					break;
				case 'uploading':
					domStyle.set(this.id + '_abort', 'display', 'inline-block');
					domStyle.set(this.id + '_pause', 'display', 'inline-block');
					break;
				case 'error':
					domClass.add(query('.dijitProgressBarTile', this.domNode)[0], 'pbwBarTileError');
					domStyle.set(this.id + '_errMsg', 'display', 'block');
					domStyle.set(this.id + '_abort', 'display', 'inline-block');
					domStyle.set(this.id + '_retry', 'display', 'inline-block');
					break;
				case 'aborted':
					domClass.add(query('.dijitProgressBarTile', this.domNode)[0], 'pbwBarTileAborted');
					domStyle.set(this.id + '_remove', 'display', 'inline-block');
					break;
				case 'paused':
					domStyle.set(this.id + '_abort', 'display', 'inline-block');
					domStyle.set(this.id + '_resume', 'display', 'inline-block');
					break;
				case 'indeterminated':
					domStyle.set(this.id + '_abort', 'display', 'inline-block');
					break;
			}
		},

		complete: function() {
			this.set('value', this.maximum);
			dom.byId(this.id + '_msg').innerHTML = 'Done. File saved on server.';
			this.setState('completed');
			this.onComplete();
		},

		upload: function() {
			dom.byId(this.id + '_msg').innerHTML = 'Uploading...';
			this.setState('uploading');
		},

		/**
		 * Sets the bar to its error state.
		 * @param {object} err error
		 */
		error: function(err) {
			var msg = err.statusCode + ' ' + err.statusText + ': <span class="errMsg">' + err.responseText + '</span>';
			dom.byId(this.id + '_errMsg').innerHTML = msg;
			this.setState('error');
			this.onError(err);
		},

		/**
		 * Sets the bar to the aborted state.
		 */
		abort: function() {
			this.aborted = true;
			dom.byId(this.id + '_msg').innerHTML = '<span class="errMsg">Upload aborted.</span>';
			this.setState('aborted');
			this.onAbort();
		},

		/**
		 * Sets bar to pause/resume state.
		 */
		pause: function() {
			this.paused = true;
			dom.byId(this.id + '_msg').innerHTML = 'Paused.';
			this.setState('paused');
			this.onPause();
		},

		resume: function() {
			this.paused = false;
			this.setState('uploading');
			this.onResume();
		},

		retry: function() {
			this.set('value', 0);
			this.setState('uploading');
			this.onRetry();
		},

		wait: function() {
			this.set('value', Infinity);
			dom.byId(this.id + '_msg').innerHTML = 'Uploading done, writing file to server.';
			this.setState('indeterminated');
		},

		del: function() {
			this.onDelete();
		},

		remove: function() {
			fx.fadeOut({
				node: this.id,
				duration: 500,
				onEnd: lang.hitch(this, function() {
					domConstruct.destroy(this.id);
					this.onRemove();
				})
			}).play();
		},

		/**
		 * Callback when user cancels upload
		 * Called when user clicks cancel link/button
		 * Stub to override
		 */
		onAbort: function() {},

		/**
		 * Callback when user retries uploading.
		 * Called when user clicks retry link/button
		 * Stub to override
		 */
		onRetry: function() {},

		/**
		 * Callback on deleting progress bar.
		 * Called when user clicks delete link/button
		 * Stub to override
		 */
		onDelete: function() {},

		/**
		 * Callback on resume/pause progress bar.
		 * Called when user clicks pause/resume link/button
		 * Stub to override
		 */
		onResume: function() {},

		onPause: function() {},

		/**
		 * Callback when upload is completed.
		 * Stub to override
		 */
		onComplete: function() {},

		/**
		 * Callback on error
		 * Stub to override
		 */
		onError: function() {},

		onRemove: function() {}

	});
});
