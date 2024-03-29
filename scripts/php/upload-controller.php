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
 * @param int $errNo
 * @param string $errMsg
 * @param string $errFile
 * @param int $errLine
 * @return void
 */
function handleError(int $errNo, string $errMsg, string $errFile, int $errLine): void {
    http_response_code(505);
	echo $errMsg;  // do not use exit, since other error_handlers/shutdown_function would not be called
	// Enable for development only:
	echo $errMsg.' in '.$errFile.' on line '.$errLine;
}

/**
 * Custom shutdown function.
 * @see http://www.php.net/register_shutdown_function
 * @return void
 */
function handleShutdown(): void {
	$err = error_get_last();
	if ($err !== NULL) {
		ob_end_clean();   // remove fatal error message in response body and replace with own message below
        http_response_code(505);
		// for development only
		echo 'Fatal error [SHUTDOWN]: '.$err['message'].' in '.$err['file'].' on line '.$err['line'];
		echo $err['message'];
	}
}

// set_error_handler() does not catch fatal errors such as exceeding the allowed memory size
// -> use register_shutdown_function() in addition
ob_start();
set_error_handler('handleError', E_ALL);
register_shutdown_function('handleShutdown');

$uploadDir = __DIR__.'/../../uploads/';  // use rtrim since on some OS doc_root is returned without/with a trailing slash
$protocol = $_SERVER["SERVER_PROTOCOL"];
$demoMode = true;
$upl = new Upload();
$upl->setDemoMode($demoMode);

// TODO: use REST instead of query string parameter fnc
$fnc = $_GET['fnc'] ?? null;
switch ($fnc) {
	case 'upl':
		if (is_dir($uploadDir)) {
			if (is_writable($uploadDir) || $demoMode) {
				$upl->save($uploadDir);
				$upl = null;
			}
			else {
                http_response_code(405);
				exit('Upload directory is not writable.');
			}
		}
		else {
            http_response_code(404);
			exit('Upload directory does not exist.');
		}
      break;
	case 'del':
		$fileName = $_GET['fileName'] ?? null;
		if ($fileName) {
			$upl->delete($fileName, $uploadDir);
			$upl = null;
		}
		else {
            http_response_code(404);
			exit('No file name provided.');
		}
      break;
	case 'resume':
		$upl->save($uploadDir, true);
		$upl = null;
		break;
	case 'getNumWrittenBytes':
		$fileName = $_GET['fileName'] ?? null;
		if (!$demoMode) {
			if ($fileName) {
				if (file_exists($uploadDir.$fileName)) {
					echo json_encode(['numWritten' => filesize($uploadDir.$fileName)], JSON_THROW_ON_ERROR);
				}
				else {
                    http_response_code(404);
					exit('Previous upload not found. Resume not possible.');
				}
			}
			else {
                http_response_code(404);
				exit('No file name provided.');
			}
		}
		break;
}