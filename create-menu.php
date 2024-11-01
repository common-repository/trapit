<?php

function trapit_plugin_create() {
    
    // Act as a router for the admin page

    $opt_vals = trapit_load_opt_vals();
    if (empty($opt_vals['trapit_slug']) || empty($opt_vals['trapit_hostname'])) {
        $forward_url = 'admin.php?page=trapit-options';
        echo "<script type='text/javascript'>window.location = '{$forward_url}';</script>";
        return;
    }

    include_once 'resources.php';

    trapit_plugin_categories();
}
