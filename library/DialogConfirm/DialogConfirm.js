define([
	'dojo/_base/lang',
	'dojo/_base/declare',
	'dojo/_base/Deferred',
	'dojo/dom-construct',
	'dijit/Dialog',
	'dijit/form/Button',
	'dijit/form/CheckBox'
], function(lang, declare, Deferred, domConstruct, Dialog, Button, Checkbox) {

	/**
	 * @class
	 * @name rfe.DialogConfirm
	 * @extends {dijit.Dialog}
	 * @property {dijit.form.Button} okButton reference to OK button
	 * @property {dijit.form.Button} cancelButton reference to Cancel button
	 * @property {dijit.form.CheckBox} skipCheckBox reference to skipping check box
	 * @property {boolean} hasOkButton create an OK button?
	 * @property {boolean} hasCancelButton create a cancel button
	 * @property {boolean} hasSkipCheckBox create the skipping check box
	 * @property {boolean} hasUnderlay create the dialog underlay?
	 * @property {dojo.Deferred} dfd Deferred
	 * @property {HTMLDivElement} buttonNode reference to div containing buttons
	 */
	return declare(Dialog, /* @lends rfe.DialogConfirm.prototype */ {
		okButton: null,
		cancelButton: null,
		skipCheckBox: null,
		hasOkButton: true,
		hasCancelButton: true,
		hasSkipCheckBox: true,
		hasUnderlay: true,
		dfd: null,
		buttonNode: null,

		/**
		 * Instantiates the confirm dialog.
		 * @constructor
		 * @param {object} props
		 */
		constructor: function(props) {
			lang.mixin(this, props);
		},

		/**
		 * Creates the OK/Cancel buttons.
		 */
		postCreate: function() {
			this.inherited('postCreate', arguments);

			var label, div, remember = false;

			div = domConstruct.create('div', {
				className: 'dijitDialogPaneContent dialogConfirm'
			}, this.domNode, 'last');

			if (this.hasSkipCheckBox) {
				this.skipCheckBox = new Checkbox({
					checked: false
				}, domConstruct.create('div'));
				div.appendChild(this.skipCheckBox.domNode);
				label = domConstruct.create('label', {
					'for': this.skipCheckBox.id,
					innerHTML: 'Remember my decision and do not ask again.<br/>'
				}, div);
			}
			if (this.hasOkButton) {
				this.okButton = new Button({
					label: 'OK',
					onClick: lang.hitch(this, function() {
						remember = this.hasSkipCheckBox ? this.skipCheckBox.get('checked') : false;
						this.hide();
						this.dfd.resolve(remember);
					})
				}, domConstruct.create('div'));
				div.appendChild(this.okButton.domNode);
			}
			if (this.hasCancelButton) {
				this.cancelButton = new Button({
					label: 'Cancel',
					onClick: lang.hitch(this, function() {
						remember = this.hasSkipCheckBox ? this.skipCheckBox.get('checked') : false;
						this.hide();
						this.dfd.cancel(remember);
					})
				}, domConstruct.create('div'));
				div.appendChild(this.cancelButton.domNode);
			}
			this.buttonNode = div;
		},

		/**
		 * Shows the dialog.
		 * @return {Deferred}
		 */
		show: function() {
			this.inherited('show', arguments);
			if (!this.hasUnderlay) {
				domConstruct.destroy(this.id + '_underlay');	// remove underlay
			}
			this.dfd = new Deferred();
			return this.dfd;
		}
	});
});