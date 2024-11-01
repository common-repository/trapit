<?php
// trapit_settings_page() displays the page content for the Test settings submenu
function trapit_plugin_options() { //settings_page() {

    $excludes = array('post' => true, 'page' => true, 'attachment' => true, 'revision' => true, 'nav_menu_item' => true);
    $custom_post_types = array_keys(array_diff_key($GLOBALS['wp_post_types'], $excludes));
    $custom_post_types[] = '';
    sort($custom_post_types);
    
    //must check that the user has the required capability
    if (!current_user_can('manage_options')) {
        wp_die( __('You do not have sufficient permissions to access this page.') );
    }
    
    // variables for the field and option names
    $options = array('email', 'password', 'source_text', 'image_class');
    $selects = array('link_target' => array('_self', '_blank', '_parent', '_top'),
                     'custom_post_type' => $custom_post_types,
                     'nofollow' => array('nofollow'),
                     'featured_image' => array('featured_image'));

    $descriptions = array('source_text' => "The default text for the link to original source content at the bottom of each post. Changing the default does not modify any posts already published.",
                          'image_class' => "The default CSS class for images appearing in Trapit content posts.",
                          'link_target' => "The window that Trapit content will appear in, by default, when the source link is clicked.",
                          'nofollow' => "When checked, adds a rel=nofollow attribute to Trapit content source links.",
                          'featured_image' => "When checked, selects the Trapit content image in the post to be used as a post thumbnail in certain Wordpress themes.",
                          'custom_post_type' => "Select a custom post type to which to send Trapit content instead of the standard Post.");
    
    $opt_vals = array();
    foreach ($options as $option) {
        $opt_name = "trapit_$option";
        $opt_vals[$opt_name] = get_option( $opt_name );
    }
    foreach ($selects as $select => $value) {
        $opt_name = "trapit_$select";
        $opt_vals[$opt_name] = get_option( $opt_name );
    }
    
    $hidden_field_name = 'trapit_submit_hidden';
    
    // Read in existing option value from database
    //$opt_val = get_option( $opt_name );
    
    // See if the user has posted us some information
    // If they did, this hidden field will be set to 'Y'
    if ( isset($_POST[ $hidden_field_name ]) && $_POST[ $hidden_field_name ] == 'Y' ) {
        // Read their posted values
        foreach (array_merge($options, array_keys($selects)) as $option) {
            $opt_name = "trapit_$option";
            $opt_val = sanitize_text_field($_POST[$opt_name]);

            // Save the posted value to the database
            update_option( $opt_name, $opt_val );
            $opt_vals[$opt_name] = $opt_val;
        }

        // Attempt authenticating with the new credentials
        $creds = trapit_universal_authenticate($opt_vals['trapit_email'], $opt_vals['trapit_password']);
        foreach ($creds as $key => $opt_val) {
            $opt_name = sanitize_text_field("trapit_$key");
            $opt_val = sanitize_text_field($opt_val);

            // Save the received credentials to the database
            update_option( $opt_name, $opt_val );
            $opt_vals[$opt_name] = $opt_val;
        }
        
        // Put a settings updated message on the screen
        
        ?>
        <div class="updated"><p><strong><?php _e('settings saved.', 'trapit-wordpress' ); ?></strong></p></div>
<?php
        
    }
        
    
    // Now display the settings editing screen
    
    echo '<div class="wrap">';
    
    // header
    
    echo "<h2>" . __( 'Trapit Login', 'trapit-wordpress' ) . "</h2>";
    
    // settings form
    
    ?>
    
    <form name="form1" method="post" action="">
    <input type="hidden" name="<?php echo $hidden_field_name; ?>" value="Y">
    
<?php
    foreach ($options as $option) {
        ?><p><?php
        $label = ucfirst(str_replace('_', ' ', $option));
        _e( "$label:", 'trapit-wordpress' );
        $opt_name = "trapit_$option";
        $opt_val = $opt_vals[ $opt_name ];
        ?>
        <input type="text" name="<?php echo $opt_name; ?>" value="<?php echo $opt_val; ?>" size="20"/>
        <?php if (array_key_exists($option, $descriptions)) { ?>
            <span class="hint--right help-hint" data-hint="<?php echo $descriptions[$option]; ?>">&nbsp;&nbsp;?</span>
        <?php } ?>
        </p><hr />
<?php
    }
    foreach ($selects as $select => $values) {
        ?><p><?php
        $label = ucfirst(str_replace('_', ' ', $select));
        _e( "$label:", 'trapit-wordpress' );
        $opt_name = "trapit_$select";
        $opt_val = $opt_vals[ $opt_name ];
        if (count($values) == 1) {
        ?>
            <input type="checkbox" name="<?php echo $opt_name; ?>" value="1"
                <?php checked($opt_val, 1); ?>/>
        <?php } else { ?>
            <select name="<?php echo $opt_name; ?>">
              <?php foreach ($values as $value) { ?>
                   <option value="<?php echo $value; ?>" <?php selected($opt_val, $value); ?>><?php echo $value; ?></option>
               <?php } ?></select><?php } ?>
        <?php if (array_key_exists($select, $descriptions)) { ?>
            <span class="hint--right help-hint" data-hint="<?php echo $descriptions[$select]; ?>">&nbsp;&nbsp;?</span>
        <?php } ?>
        </p><hr />
    <?php
    }
    ?>
    
    <p class="submit">
    <input type="submit" name="Submit" class="button-primary" value="<?php esc_attr_e('Save Changes') ?>" />
    </p>
    
    </form>
    </div>
    
<?php
    
}

function trapit_universal_authenticate($email, $password) {
    $url = 'https://trap.it/api/v4/auth/';
    $body = array('email' => $email, 'password' => $password);
    
    // Universal auth endpoint usage
    // POST /api/v4/auth/
    // {"email": EMAIL, "password": PWD}
    
    // Response:
    // {'slug': org_slug,
    // 'hostname': host_name,
    // 'user_id': user_id (hex),
    // 'api_key': api_key (hex)}

    // Actual Response:
    //
    // Array
    // (
    //     [api_key] => 099aae482c204cec88ad0fbb8223a472
    //     [hostname] => st1.staging.trap.it
    //     [user_id] => 877f28c798ea4099a977041fc2f6673e
    //     [slug] => st
    // )
    
    $args = array(
        'timeout'     => 35,
        'redirection' => 5,
        'httpversion' => '1.0',
        'user-agent'  => 'WordPress/' . $wp_version . '; ' . get_bloginfo( 'url' ),
        'blocking'    => true,
        'headers'     => array(),
        'cookies'     => array(),
        'compress'    => false,
        'decompress'  => true,
        'sslverify'   => true,
        'stream'      => false,
        'filename'    => null,
        'body'        => json_encode($body)
    );
    
    $response = wp_remote_post($url, $args);
    
    if (is_wp_error($response)) {
        $error_message = $response->get_error_message();
        wp_die(__("Error authenticating. Is your email and password correct? Error message: $error_message"));
    }
    $json_body = wp_remote_retrieve_body( $response );
    $body = json_decode($json_body, $assoc_array=true);

    // check JSON response for error messages, die if present
    if (isset($body['errors'])) {
        $errors = $body['errors'];
        array_unshift($errors, 'Error verifying credentials:');
        $err_msg = implode('<br/>', $errors);
        wp_die($err_msg);
    }

    return $body;
}
