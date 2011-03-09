<!DOCTYPE html>
<html>
<head>
<title>www.speich.net - HTML5 multiple file uploader with drag and drop.</title>
<style type="text/css">
@import "../../library/dojo/dijit/themes/claro/claro.css";
@import "library/speich.net/uploader/resources/uploader.css";

#dropTarget {
	width: 400px;
	font-size: 10px;
	text-align: center;
	min-height: 120px;
	padding: 6px;
	-moz-border-radius: 8px;
	-webkit-border-radius: 8px;
	border-radius: 8px;
	border: 1px solid #ccc;
	background-color: #eee;
}

.targetActive {
	-moz-box-shadow: 0 0 15px #006666;
	-webkit-box-shadow: 0 0 15px #006666;
	box-shadow: 0 0 15px #006666;
}

</style>
</head>

<body class="claro">
<h1>HTML5 multiple file upload with dojo and PHP</h1>
<p>This page uses dojo and PHP to handle multiple file upload with drag and drop. Works with Mozilla Firefox 3.6 and Google Chrome 7.</p>
<div id="dropTarget"><p>Drop files from your desktop here</p></div>
<script type="text/javascript">
var djConfig = {
	parseOnLoad: false,
	isDebug: false,
	locale: 'en',
	modulePaths: {
		'snet': '../../speich.net'
	},
	useCommentedJson: true
};
</script>
<script src="../../library/dojo/dojo/dojo.js" type="text/javascript"></script>
<script type="text/javascript">
dojo.require('snet.Uploader');

dojo.ready(function() {
	var upl = new snet.Uploader({
		url: '/library/speich.net/uploader/uploaderfnc.php',
		dropTarget: 'dropTarget',
		maxKBytes: 5000000,
		maxNumFiles: 10
	});
});
</script>
</body>
</html>