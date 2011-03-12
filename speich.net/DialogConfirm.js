/**
 * Created by Simon Speich, www.speich.net
 * Date: 02.01.2011, v1.0
 */
dojo.require("dijit.Dialog");
dojo.require('dijit.form.Button');
dojo.require('dijit.form.CheckBox');
dojo.provide('snet.DialogConfirm');
dojo.declare('snet.DialogConfirm', dijit.Dialog, {
	okButton: null,
	cancelButton: null,
	skipCheckBox: null,
	hasOkButton: true,
	hasCancelButton: true,
	hasSkipCheckBox: true,
	dfd: null,

	/**
	 * Instantiates the confirm dialog.
	 */
	constructor: function(props) {
		this.dfd = new dojo.Deferred();
		dojo.safeMixin(this, props);
	},

	/**
	 * Creates the OK/Cancel buttons.
	 */
	postCreate: function() {
		this.inherited(arguments);

		var remember = false;
		var div = dojo.create('div', {
			className: 'pbwDialogConfirm'
		}, this.domNode, 'last');

		if (this.hasSkipCheckBox) {
			this.skipCheckBox = new dijit.form.CheckBox({
				checked: false
			}, dojo.create('div'));
			div.appendChild(this.skipCheckBox.domNode);
			var label = dojo.create('label', {
				'for': this.skipCheckBox.id,
				innerHTML: 'Remember my decision and do not ask again.<br/>'
			}, div);
		}
		if (this.hasOkButton) {
			this.okButton = new dijit.form.Button({
				label: 'OK',
				onClick: dojo.hitch(this, function() {
					remember = this.hasSkipCheckBox ? this.skipCheckBox.get('checked') : false;
					this.hide();
					this.dfd.resolve(remember);
				})
			}, dojo.create('div'));
			div.appendChild(this.okButton.domNode);
		}
		if (this.hasCancelButton) {
			this.cancelButton = new dijit.form.Button({
				label: 'Cancel',
				onClick: dojo.hitch(this, function() {
					remember = this.hasSkipCheckBox ? this.skipCheckBox.get('checked') : false;
					this.hide();
					this.dfd.cancel(remember);
				})
			}, dojo.create('div'));
			div.appendChild(this.cancelButton.domNode);

		}
	},

	/**
	 * Shows the dialog.
	 * @return {dojo.Deferred}
	 */
	show: function() {
		this.inherited(arguments);
		return this.dfd;
	}
});