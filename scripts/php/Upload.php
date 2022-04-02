<?php

class Upload
{
    private int $numWrittenBytes = 0;
    private string $fileName;
    private bool $demoMode = true;

    /**
     * Set demo modus.
     * @param bool $demoMode
     * @return void
     */
    public function setDemoMode(bool $demoMode): void
    {
        $this->demoMode = $demoMode;
    }

    /**
     * Delete uploaded file.
     * @param string $file file name
     * @param string $dir upload directory
     * @return void
     */
    public function delete(string $file, string $dir): void
    {
        $protocol = $_SERVER["SERVER_PROTOCOL"];

        // Disable this, if you want to delete file from server. Make sure you have the right permissions.
        if ($this->demoMode) {
            http_response_code(501);
            exit('Deleting failed since file was not saved to server in this demo.');
        }

        // Important: You should also add a session variable to make sure that a the user can only delete his own files!
        if (is_file($dir.$file)) {
            $succ = unlink($dir.$file);
            if ($succ) {
                http_response_code(200);
                exit('File deleted.');
            }

            http_response_code(500);
            exit('Deleting failed');
        }

        http_response_code(404);
        exit('File does not exist.');
    }

    /**
     * Save uploaded file to disk.
     * Note: In this demo files are not written to disk. You have to uncomment the corresponding lines.
     * @param string dir upload directory
     * @param bool $append append to file (resume)
     * @return void
     */
    public function save(string $dir, bool $append = false): void
    {
        $headers = getallheaders();
        if (!isset($headers['Content-Length'])) {
            http_response_code(411);
            exit('Header \'Content-Length\' not set.');
        }

        /*if (isset($headers['Content-Type'], $headers['X-File-Size'], $headers['X-File-Name']) &&
            ($headers['Content-Type'] === 'multipart/form-data' || $headers['Content-Type'] === 'application/octet-stream; charset=UTF-8')) {*/
        if (isset($headers['X-File-Size'], $headers['X-File-Name'])) {
            // Sanitize all uploaded headers before saving to disk
            // Enable writing to disk at your own risk! Special care needs to be taken, that only the right person can
            // save/append a file. Also the type is not checked, a user can upload anything!
            $file = new stdClass();
            $file->name = preg_replace('/[^ \.\w_\-]*/', '', basename($headers['X-File-Name']));
            $file->size = preg_replace('/\D*/', '', $headers['X-File-Size']);

            // php://input bypasses the ini settings, we have to limit the file size ourselves:
            // Find smallest init setting and set upload limit accordingly.
            $maxUpload = $this->getBytes(ini_get('upload_max_filesize')); // can only be set in php.ini and not by ini_set()
            $maxPost = $this->getBytes(ini_get('post_max_size'));         // can only be set in php.ini and not by ini_set()
            $memoryLimit = $this->getBytes(ini_get('memory_limit'));
            $limit = min($maxUpload, $maxPost, $memoryLimit);
            if ($headers['Content-Length'] > $limit) {
                http_response_code(403);
                exit('File size to big. Limit is '.$limit.' bytes.');
            }

            $this->fileName = $file->name;
            $file->content = file_get_contents("php://input");

            // Since I don't know if the header content-length can be spoofed/is reliable, I check the file size again after it is uploaded
            if (mb_strlen($file->content) > $limit) {
                http_response_code(403);
                exit('Nice try.');
            }

            // Uncomment if you want to write to server. Make sure you have the right permissions.
            $flags = $append ? FILE_APPEND : 0;
            if ($this->demoMode) {
                // In the demo we do not write anything to disk, sleep to fake it, so we can show bar.indeterminate on the client
                sleep(2);
                $this->numWrittenBytes = mb_strlen($headers['Content-Length']);
            } else {
                $this->numWrittenBytes = file_put_contents($dir.$file->name, $file->content, $flags);
            }

            if ($this->numWrittenBytes !== false) {
                http_response_code(201);
                exit('File written.');
            }

            http_response_code(505);
            exit('Error writing file');
        }

        http_response_code(500);
        exit('Correct headers are not set.');
    }

    /**
     * @see http://ch2.php.net/manual/en/function.ini-get.php
     * @param string $val
     * @return int
     */
    public function getBytes(string $val): int
    {
   		$val = trim($val);
   		$last = strtolower($val[strlen($val) - 1]);
   		switch ($last) {
   			// The 'G' modifier is available since PHP 5.1.0
   			case 'g':
   				$val *= 1024;
   			case 'm':
   				$val *= 1024;
   			case 'k':
   				$val *= 1024;
   		}
   		return $val;
   	}

    public function getNumWrittenBytes(): int
    {
        return $this->numWrittenBytes;
    }
}


