<?php

/*
 * Add custom trapit variables to the query_vars filter
 */
function add_query_vars_filter($vars) {
    $vars[] = 'trap_id';
    $vars[] = 'category_id';

    return $vars;
}
add_filter( 'query_vars', 'add_query_vars_filter' );

include 'icon-b64.php';

add_action( 'admin_menu', 'trapit_plugin_menu' );
function trapit_plugin_menu() {
    add_menu_page( 'Trapit', 'Trapit', 'manage_options', 'trapit-menu-page', 'trapit_plugin_create', get_trapit_icon_b64() ); // $position
    add_submenu_page('trapit-menu-page', 'Create a Post', 'Create a Post', 'manage_options', 'trapit-menu-page', 'trapit_plugin_create');
    add_submenu_page('trapit-menu-page', 'Settings', 'Settings', 'manage_options', 'trapit-options', 'trapit_plugin_options');
}


function trapit_scripts_enqueue($hook) {
    // only enqueue scripts when page=trapit-menu-page
    $wp_screen = get_current_screen();
    //trapit_preout($wp_screen->base);
    if ($wp_screen->base == 'toplevel_page_trapit-menu-page') {
        wp_enqueue_script('webcomponents', plugin_dir_url( __FILE__ ) . 'webcomponents.min.js');
        wp_enqueue_script('isotope', plugin_dir_url( __FILE__ ) . 'isotope.pkgd.min.js');
        wp_enqueue_script('imagesloaded', plugin_dir_url( __FILE__ ) . 'imagesloaded.pkgd.min.js');
        wp_enqueue_script('fetch', plugin_dir_url( __FILE__ ) . 'fetch.js', array('webcomponents'));
        wp_enqueue_script('user', plugin_dir_url( __FILE__ ) . 'user.js', array('webcomponents', 'isotope', 'imagesloaded', 'fetch', 'jquery'));
    } else {
        wp_enqueue_style('help-hint', plugin_dir_url( __FILE__ ) . 'help-hint.css');
        wp_enqueue_style('trapit-hint', plugin_dir_url( __FILE__ ) . 'hint.css');
    }
}
add_action('admin_enqueue_scripts', 'trapit_scripts_enqueue');


include 'create-menu.php';
include 'options-menu.php';
include 'categories-menu.php';


// AUTHENTICATION
// curl --insecure -L https://example.trap.it/api/v4/{org_slug}/auth/basic/verify/ -X POST -d '{"auth_id":"user@trapit.com","auth_secret":"myPassword"}'

// Response
// {
// "session": "[session_id]",
// "user_id": "[user_id]"
// }

// GET -> Collection of User’s Traps

// curl -u "<user_id>:<session_id>" -L https://example.trap.it/api/v4/{org_slug}/users/{user_id}/traps/

// GET trap queue
//https://example.trap.it/api/v4/{org_slug}/traps/{trap_id}/queue/


function trapit_preout(&$var) {
    echo '<br/><pre>';
    print_r($var);
    echo '</pre>';
}

function trapit_load_opt_vals() {
    $options = array('slug', 'hostname', 'user_id', 'api_key', 'source_text', 'link_target', 'nofollow',
                     'image_class', 'featured_image', 'custom_post_type');

    $opt_vals = array();
    foreach ($options as $option) {
        $opt_name = "trapit_$option";
        $opt_vals[$opt_name] = get_option( $opt_name );
    }

    return $opt_vals;
}


function trapit_starts_with($haystack, $needle) {
    $length = strlen($needle);
    return (substr($haystack, 0, $length) === $needle);
}

function load_categories_traps(&$category_ids_names, &$category_ids_traps, &$trap_ids_names, &$trap_ids_queues) {
    //must check that the user has the required capability
    if (!current_user_can('manage_options')) {
        wp_die( __('You do not have sufficient permissions to access this page.') );
    }

    $opt_vals = trapit_load_opt_vals();

    // no-slings-out=true in the URL below prevents "feeder" traps from showing up
    $url = "https://{$opt_vals[trapit_hostname]}/api/v4/{$opt_vals[trapit_slug]}/public-traps/?pretty=true&type=bundle&size=500&no-slings-out=true";
    $args = array(
        'timeout'     => 35,
        'redirection' => 5,
        'httpversion' => '1.0',
        'user-agent'  => 'WordPress/' . $wp_version . '; ' . get_bloginfo( 'url' ),
        'blocking'    => true,
        'headers'     => array(),
        'cookies'     => array(),
        'body'        => null,
        'compress'    => false,
        'decompress'  => true,
        'sslverify'   => true,
        'stream'      => false,
        'filename'    => null
    );

    $response = wp_remote_get($url, $args);

    if (is_wp_error($response)) {
        $error_message = $response->get_error_message();
        wp_die(__("Error retrieving public traps: $error_message"));
    } else {
        // echo 'Response:<pre>';
        // print_r( $url );
        $json_body = wp_remote_retrieve_body( $response );
        $body = json_decode($json_body);
        // print_r( $body );
        // echo '</pre>';

        // pluck out & display desired values from body
        $next = $body->next;
        $prev = $body->prev;
        $records = $body->records;


        // iterating public traps
        foreach ($records as $record) {
            $trap_ids_names[$record->id] = $record->name;
            $trap_ids_queues[$record->id] = array();

            if (!empty($record->categories)) {
                foreach ($record->categories as $category) {
                    $category_ids_names[$category->id] = $category->name;
                    if (!isset($category_ids_traps[$category->id])) {
                        $category_ids_traps[$category->id] = array();
                    }
                    array_push($category_ids_traps[$category->id], $record->id);
                }
            } else {
                // trap has no category associated with it
                // create an Other category
                $category_ids_names['0'] = 'Other';
                if (!isset($category_ids_traps['0'])) {
                    $category_ids_traps['0'] = array();
                }
                array_push($category_ids_traps['0'], $record->id);
            }
        }

        // sort categories by name, leaving "Other" in last place
        asort($category_ids_names, SORT_STRING | SORT_FLAG_CASE);
        if (isset($category_ids_names['0'])) {
            unset($category_ids_names['0']);
            $category_ids_names['0'] = 'Other';
        }

    }
}


// WORDPRESS POST FORMAT
// $post = array(
//     'ID'             => [ <post id> ] // Are you updating an existing post?
//     'post_content'   => [ <string> ] // The full text of the post.
//     'post_name'      => [ <string> ] // The name (slug) for your post
//     'post_title'     => [ <string> ] // The title of your post.
//     'post_status'    => [ 'draft' | 'publish' | 'pending'| 'future' | 'private' | custom registered status ] // Default 'draft'.
//     'post_type'      => [ 'post' | 'page' | 'link' | 'nav_menu_item' | custom post type ] // Default 'post'.
//     'post_author'    => [ <user ID> ] // The user ID number of the author. Default is the current user ID.
//     'ping_status'    => [ 'closed' | 'open' ] // Pingbacks or trackbacks allowed. Default is the option 'default_ping_status'.
//     'post_parent'    => [ <post ID> ] // Sets the parent of the new post, if any. Default 0.
//     'menu_order'     => [ <order> ] // If new post is a page, sets the order in which it should appear in supported menus. Default 0.
//     'to_ping'        => // Space or carriage return-separated list of URLs to ping. Default empty string.
//     'pinged'         => // Space or carriage return-separated list of URLs that have been pinged. Default empty string.
//     'post_password'  => [ <string> ] // Password for post, if any. Default empty string.
//     'guid'           => // Skip this and let Wordpress handle it, usually.
//     'post_content_filtered' => // Skip this and let Wordpress handle it, usually.
//     'post_excerpt'   => [ <string> ] // For all your post excerpt needs.
//     'post_date'      => [ Y-m-d H:i:s ] // The time post was made.
//     'post_date_gmt'  => [ Y-m-d H:i:s ] // The time post was made, in GMT.
//     'comment_status' => [ 'closed' | 'open' ] // Default is the option 'default_comment_status', or 'closed'.
//     'post_category'  => [ array(<category id>, ...) ] // Default empty.
//     'tags_input'     => [ '<tag>, <tag>, ...' | array ] // Default empty.
//     'tax_input'      => [ array( <taxonomy> => <array | string> ) ] // For custom taxonomies. Default empty.
//     'page_template'  => [ <string> ] // Requires name of template file, eg template.php. Default empty.
// );
