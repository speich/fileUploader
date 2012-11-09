<?php
/**
 * Created by Simon Speich, 27.02.2011
 *
 * Note: For uploading the following php.ini directives have to be set correctly:
 * memory_limit (if set) > post_max_size > upload_max_filesize
 * Uploading is also affected by max_execution_time and max_input_time and by the apache's timeout directive.
 */
require_once('Upload.php');


/**
 * Custom error handling function.
 * @see http://www.php.net/set_error_handler
 * @param {integer} $errNo
 * @param {string} $errMsg
 * @param {string} $errFile
 * @param {integer} $errLine
 * @return void
 */
function handleError($errNo, $errMsg, $errFile, $errLine) {
	header($_SERVER["SERVER_PROTOCOL"].' 505 Internal Server Error');
	echo $errMsg;  // do not use exit, since other error_handlers/shutdown_function would not be called
	// Enable for development only:
	//echo $errMsg.' in '.$errFile.' on line '.$errLine;
}

/**
 * Custom shutdown function.
 * @see http://www.php.net/register_shutdown_function
 * @return void
 */
function handleShutdown() {
	$err = error_get_last();
	if ($err !== NULL) {
		ob_end_clean();   // remove fatal error message in response body and replace with own message below
		header($_SERVER["SERVER_PROTOCOL"].' 505 Internal Server Error');
		// for development only
		// echo 'Fatal error [SHUTDOWN]: '.$err['message'].' in '.$err['file'].' on line '.$err['line'];
		echo $err['message'];
	}
}

// set_error_handler() does not catch fatal errors such as exceeding the allowed memory size
// -> use register_shutdown_function() in addition
ob_start();
set_error_handler('handleError', E_ALL);
register_shutdown_function('handleShutdown');

$uploadDir = rtrim($_SERVER['DOCUMENT_ROOT']).'/speich.net/fileUploader/uploads/';  // use rtrim since on some OS doc_root is returned without/with a trailing slash
$protocol = $_SERVER["SERVER_PROTOCOL"];
$demoMode = true;
$upl = new Upload();
$upl->setDemoMode($demoMode);

// TODO: use REST instead of query string parameter fnc
$fnc = isset($_GET['fnc']) ? $_GET['fnc'] : null;
switch ($fnc) {
	case 'upl':
		if (is_dir($uploadDir)) {
			if (is_writable($uploadDir) || $demoMode) {
				$upl->save($uploadDir);
				$upl = null;
			}
			else {
				header($protocol.' 405 Method Not Allowed');
				exit('Upload directory is not writable.');
			}
		}
		else {
			header($protocol.' 404 Not Found');
			exit('Upload directory does not exist.');
		}
      break;
	case 'del':
		$fileName = isset($_GET['fileName']) ? $_GET['fileName'] : null;
		if ($fileName) {
			$upl->delete($fileName, $uploadDir);
			$upl = null;
		}
		else {
			header($protocol.' 404 Not Found');
			exit('No file name provided.');
		}
      break;
	case 'resume':
		$upl->save($uploadDir, true);
		$upl = null;
		break;
	case 'getNumWrittenBytes':
		$fileName = isset($_GET['fileName']) ? $_GET['fileName'] : null;
		if (!$demoMode) {
			if ($fileName) {
				if (file_exists($uploadDir.$fileName)) {
					echo json_encode(array('numWritten' => filesize($uploadDir.$fileName)));
				}
				else {
					header($protocol.' 404 Not Found');
					exit('Previous upload not found. Resume not possible.');
				}
			}
			else {
				header($protocol.' 404 Not Found');
				exit('No file name provided.');
			}
		}
		break;
}
?>