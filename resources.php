<?php

// Include resources required for presentation of Trapit data in plugin

// helper function for reading resources relative to this file
function readfilerelativetothis($filename) {
    readfile(join(DIRECTORY_SEPARATOR, array(dirname(__FILE__), $filename)));
}

// Transfer values from server PHP to client JavaScript
?>
<script type="text/javascript"><?php
$opt_vals = trapit_load_opt_vals();
$opt_vals_json = json_encode($opt_vals);
echo "trapit_opt_vals = $opt_vals_json;";
?></script>
<?php
