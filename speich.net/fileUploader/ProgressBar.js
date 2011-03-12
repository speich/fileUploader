/**
 * Created by Simon Speich, www.speich.net
 * Date: 11.12.10, v1.0
 */
dojo.require('dijit.ProgressBar');
dojo.provide('snet.fileUploader.ProgressBar');
dojo.declare('snet.fileUploader.ProgressBar', dijit.ProgressBar, {
	aborted: false,  // user aborted upload
	paused: false,
	statics: {id: 0}, // static variable to create unique widget id, if none is provided
	label: '',
	xhr: null,       // reference to XmlHttpRequest object

	/**
	 * Instantiates the progress bar.
	 * @param {object} props
	 */
	constructor: function(props) {
		var strHtml;
		dojo.safeMixin(this, props);

		// extend dijit template string
		strHtml = '<div class="pbwBar">' +
			'<div id="${id}_thumb" class="pbwThumb"></div>' +
			'<div class="pbwBarContRight">' +
			'<div id="${id}_text" class="pbwTxt">' + this.label + '</div>' + this.get('templateString') +
			'<div id="${id}_msg" class="pbwMsg"></div>' +
			'<div id="${id}_errMsg" class="pbwMsg"></div>' +
			'<div id="${id}_abort" class="pbwButton">abort</div>' +
			'<div id="${id}_pause" class="pbwButton">pause</div>' +
			'<div id="${id}_resume" class="pbwButton">resume</div>' +
			'<div id="${id}_retry" class="pbwButton">retry</div>' +
			'<div id="${id}_del" class="pbwButton">delete</div>' +
			'<div id="${id}_remove" class="pbwButton">remove</div>' +
			'</div>' +
			'</div>';
		this.set('templateString', strHtml);
	},

	/**
	 * Setup the bar's button/link events.
	 */
	postCreate: function() {
		dojo.connect(dojo.byId(this.id + '_abort'), 'click', this, this.abort);
		dojo.connect(dojo.byId(this.id + '_retry'), 'click', this, this.retry);
		dojo.connect(dojo.byId(this.id + '_del'), 'click', this, this.del);
		dojo.connect(dojo.byId(this.id + '_pause'), 'click', this, this.pause);
		dojo.connect(dojo.byId(this.id + '_resume'), 'click', this, this.resume);
		dojo.connect(dojo.byId(this.id + '_remove'), 'click', this, this.remove);
	},

   /**
    * Create and display an icon for the file.
    * @param {File} file
    * @param {number} newWidth width of icon
    * @return {dojo.Deferred}
    */
	setIcon: function(file, newWidth) {
	   var img = new Image();
	   var newHeight;
	   var fileType = file.type.toLowerCase();
	   var el = dojo.byId(this.id + '_thumb');
	   var dfd = new dojo.Deferred();

	   if (fileType.match(/image\/*/)) {
			newWidth = newWidth - 8;  // 2 x 4px from css border
			if (fileType.match(/image\/(jpg|gif|png|jpeg)/)) {
				dfd = this.createThumb(file, newWidth);
			}
			else {
				img.src = dojo.moduleUrl('snet') + '/fileUploader/resources/icon-image_64.png';
				img.onload = function() {	 // resize to fit icon
					newHeight = Math.floor(img.height * newWidth / img.width);
					img.width = newWidth;
					img.height = newHeight;
					dfd.resolve(img);
				}
			}
	      dfd.then(function(img) {
				var div = dojo.create('div', {
					'class': 'pbwThumbCanvas',
					style: {
						opacity: 0,
						backgroundImage: 'url(' + img.src + ') ',
						backgroundSize: img.width + 'px ' + img.height + 'px'
					},
					innerHTML: '<img src="' + img.src + '" style="visibility: hidden" width="' + img.width + '" height="' + img.height + '"/>'
				}, el);
		      dojo.fadeIn({
			      node: div,
			      duration: 500
		      }).play();
				return img;
	      });
	   }
		else {
			if (fileType.match(/video\/*/)) {
				img.src = dojo.moduleUrl('snet') + '/fileUploader/resources/icon-video_64.png'
			}
			else if (fileType.match(/audio\/*/)) {
				img.src = dojo.moduleUrl('snet') + '/fileUploader/resources/icon-audio_64.png'
			}
			else if (fileType.match(/text\/*/)) {
				img.src = dojo.moduleUrl('snet') + '/fileUploader/resources/icon-text_64.png'
			}
			else {
				img.src = dojo.moduleUrl('snet') + '/fileUploader/resources/icon-generic_64.png'
			}
			dojo.place(img, el, 'first');
		   dfd.resolve(img);
		}
	   return dfd;
   },

	/**
	 * Creates a thumbnail from the provided image file.
	 * Returns a dojo.Deferred which resolves to an image.
	 * @param {File} file
	 * @param {number} newWidth width of thumbnail
	 * @return {dojo.Deferred}
	 */
	createThumb: function(file, newWidth) {
		var dfd = new dojo.Deferred();
		var reader = new FileReader();
		reader.onload = function(evt) {
			var img = new Image();
			img.src = evt.target.result;
			img.onload = function() {
				var newHeight = Math.floor(img.height * newWidth / img.width);
				var canvas = dojo.create('canvas', {
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
		dojo.removeClass(dojo.query('.dijitProgressBarTile', this.domNode)[0], cssClasses);
		dojo.style(this.id + '_abort', 'display', 'none');
		dojo.style(this.id + '_errMsg', 'display', 'none');
		dojo.style(this.id + '_retry', 'display', 'none');
		dojo.style(this.id + '_del', 'display', 'none');
		dojo.style(this.id + '_pause', 'display', 'none');
		dojo.style(this.id + '_resume', 'display', 'none');
		
		switch(state) {
			case 'completed':
				dojo.addClass(dojo.query('.dijitProgressBarTile', this.domNode)[0], 'pbwBarTileDone');
				dojo.style(this.id + '_del', 'display', 'inline-block');
				break;
			case 'uploading':
				dojo.style(this.id + '_abort', 'display', 'inline-block');
				dojo.style(this.id + '_pause', 'display', 'inline-block');
				break;
			case 'error':
				dojo.addClass(dojo.query('.dijitProgressBarTile', this.domNode)[0], 'pbwBarTileError');
				dojo.style(this.id + '_errMsg', 'display', 'block');
				dojo.style(this.id + '_abort', 'display', 'inline-block');
				dojo.style(this.id + '_retry', 'display', 'inline-block');
				break;
			case 'aborted':
				dojo.addClass(dojo.query('.dijitProgressBarTile', this.domNode)[0], 'pbwBarTileAborted');
				dojo.style(this.id + '_remove', 'display', 'inline-block');
				break;
			case 'paused':
				dojo.style(this.id + '_abort', 'display', 'inline-block');
				dojo.style(this.id + '_resume', 'display', 'inline-block');
				break;
			case 'indeterminated':
				dojo.style(this.id + '_abort', 'display', 'inline-block');
				break;
		}
	},

	complete: function() {
		this.update({
			indeterminate: false,
			progress: this.maximum
		});
		dojo.byId(this.id + '_msg').innerHTML = 'Done. File saved on server.';
		this.setState('completed');
		this.onComplete();
	},

	upload: function() {
		this.update({
			indeterminate: false
		});
		dojo.byId(this.id + '_msg').innerHTML = 'Uploading...';
		this.setState('uploading');
	},

	/**
	 * Sets the bar to its error state.
	 * @param {object} err error
	 */
	error: function(err) {
		var msg = err.statusCode + ' ' + err.statusText + ': <span class="errMsg">' + err.responseText + '</span>';
		dojo.byId(this.id + '_errMsg').innerHTML = msg;
		this.setState('error');
		this.onError(err);
	},

	/**
	 * Sets the bar to the aborted state.
	 */
	abort: function() {
		this.aborted = true;
		dojo.byId(this.id + '_msg').innerHTML = '<span class="errMsg">Upload aborted.</span>';
		this.setState('aborted');
		this.onAbort();
	},

	/**
	 * Sets bar to pause/resume state.
	 */
	pause: function() {
		this.paused = true;
		dojo.byId(this.id + '_msg').innerHTML = 'Paused.';
		this.setState('paused');
		this.onPause();
	},

	resume: function() {
		this.paused = false;
		this.setState('uploading');
		this.onResume();
	},

	retry: function() {
		this.update({
			indeterminate: false
		});
		this.setState('uploading');
		this.onRetry();
	},

	wait: function() {
		this.update({
			indeterminate: true
		});
		dojo.byId(this.id + '_msg').innerHTML = 'Uploading done, writing file to server.';
		this.setState('indeterminated');
	},

	del: function() {
		this.onDelete();
	},

	remove: function() {
		var anim = dojo.fadeOut({
			node: this.id,
			duration: 500,
			onEnd: dojo.hitch(this, function() {
				dojo.destroy(this.id);
				this.onRemove();
			})
		}).play();
	},

	/**
	 * Sets the progress bars properties, e.g. updates the bar.
	 * @see dijit.ProgressBar.update for details.
	 * @param {object} props properties
	 */
	update: function(props) {
		if ('progress' in props) {
			this.onBeforeUpdate(props);
		}
		this.inherited(arguments);
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

	onRemove: function() {},

	/**
	 * Callback before updating bar.
	 * Stub to override
	 */
	onBeforeUpdate: function() {}
});
