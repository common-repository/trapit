<?php

function trapit_plugin_categories() {
    $opt_vals = trapit_load_opt_vals();
    $source_text = $opt_vals['trapit_source_text'] ? $opt_vals['trapit_source_text'] : 'Source';
    $link_target = $opt_vals['trapit_link_target'] ? $opt_vals['trapit_link_target'] : '_self';
    $post_type = $opt_vals['trapit_custom_post_type'] ? $opt_vals['trapit_custom_post_type'] : 'post';
    $nofollow = $opt_vals['trapit_nofollow'] ? " rel='nofollow'" : '';
    $image_class = $opt_vals['trapit_image_class'] ? "class='{$opt_vals['trapit_image_class']}'" : '';
    $hidden_field_name = 'trapit_submit_hidden';
    $trapit_post_item = 'trapit_post_item';
    $trapit_post_field_names = array('title', 'summary', 'id', 'image_url', 'original');
    if ( isset($_POST[ $hidden_field_name ]) && $_POST[ $hidden_field_name ] == 'Y' ) {
        
        $trapit_post_fields = array();
        foreach ($trapit_post_field_names as $trapit_post_field_name) {
            $field_name = 'trapit_' . $trapit_post_field_name;
            $trapit_post_fields[$field_name] = $_POST[$field_name];
        }
        
        $original_sanitized = htmlspecialchars($trapit_post_fields['trapit_original']);
        $image_url_sanitized = htmlspecialchars($trapit_post_fields['trapit_image_url']);
        $image_tag = $trapit_post_fields['trapit_image_url'] && $trapit_post_fields['trapit_image_url'] != 'undefined'
                   ? "<img src='{$image_url_sanitized}' width='500' {$image_class}/>\n\n"
                   : '';
        $post_content = $image_tag
                      . htmlspecialchars($trapit_post_fields['trapit_summary'])
                      . "\n\n<a href='{$original_sanitized}' target='{$link_target}'{$nofollow}>{$source_text}</a>\n\n";

        $post = array(
            'post_content'   => $post_content, // The full text of the post.
            'post_content_filtered' => $post_content,
            'post_name'      => htmlspecialchars(strtolower($trapit_post_fields['trapit_title']), ENT_QUOTES), // The name (slug) for your post
            'post_title'     => $trapit_post_fields['trapit_title'], // The title of your post.
            'post_status'    => 'draft',
            'post_type'      => $post_type,
            'post_excerpt'   => $trapit_post_fields['trapit_summary'] // For all your post excerpt needs.
            //'post_category'  => array("category id", "..."), // Default empty.
            //'tags_input'     => array('<tag>', '<tag>', '...'), // Default empty.
            //'tax_input'      => array( '<taxonomy>' => array() ) // For custom taxonomies. Default empty.
        );

        $post_id = wp_insert_post($post);

        if ($post_id
            && $image_tag
            && $opt_vals['trapit_featured_image']) {
            trapit_create_featured_image($post_id, $trapit_post_fields['trapit_image_url']);
        }
        
        $forward_url = "post.php?post={$post_id}&action=edit";
        // forward browser
        echo "<script type='text/javascript'>window.location = '{$forward_url}';</script>";
        return;
    }

    echo '<div id="trapit-window">';

    echo '<template id="trapit-template">';
    ?><!-- Google Fonts -->
      <style>@import 'https://fonts.googleapis.com/css?family=Merriweather';</style>
      <style><?php readfile(join(DIRECTORY_SEPARATOR, array(dirname(__FILE__), 'base.css'))); ?></style>
      <style><?php readfile(join(DIRECTORY_SEPARATOR, array(dirname(__FILE__), 'trapit_traps_list.css'))); ?></style>
      <style><?php readfile(join(DIRECTORY_SEPARATOR, array(dirname(__FILE__), 'spinner.css'))); ?></style>
<?php
    

    echo '</template>';
    echo '</div>'; // trapit-window
}

function trapit_create_featured_image($post_id, $image_url) {
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

    $response = wp_remote_get($image_url, $args);
    if (is_wp_error($response)) {
        $error_message = $response->get_error_message();
        wp_die(__('Error retrieving featured image:') . " $error_message");
    } else {
        $image_data = wp_remote_retrieve_body($response);
        $filename = basename($image_url);
        $upload_dir = wp_upload_dir();
        
        if (wp_mkdir_p($upload_dir['path'])) {
            $file = $upload_dir['path'] . '/' . $filename;
        } else {
            $file = $upload_dir['basedir'] . '/' . $filename;
        }
        file_put_contents($file, $image_data);

        $wp_filetype = wp_check_filetype($filename, null);
        $attachment = array(
            'post_mime_type' => $wp_filetype['type'],
            'post_title' => sanitize_file_name($filename),
            'post_content' => '',
            'post_status' => 'inherit'
        );
        $attach_id = wp_insert_attachment($attachment, $file, $post_id);

        require_once(ABSPATH . 'wp-admin/includes/image.php');
        $attach_data = wp_generate_attachment_metadata($attach_id, $file);
        wp_update_attachment_metadata($attach_id, $attach_data);

        set_post_thumbnail($post_id, $attach_id);
    }
}


class Element {
    public $description = null;
    public $contents = null;
    protected $eletype = null;
    
    function __construct($description, $contents=null, $other=null) {
        $this->description = $description;
        $this->contents = $contents;
        $this->other = $other;
    }

    function __toString() {
        $class_prop = is_null($this->description) ? '' : " class='{$this->description}'";
        $other = is_null($this->other) ? '' : ' ' . $this->other;
        $accumulator = "<{$this->eletype}{$class_prop}{$other}>";
        if (is_array($this->contents)) {
            foreach($this->contents as $content) {
                $accumulator .= $content;
            }
        } else {
            $accumulator .= $this->contents;
        }
        $accumulator .= "</{$this->eletype}>";
        return $accumulator;
    }
}

class Div extends Element {
    protected $eletype = 'div';
}

class Span extends Element {
    protected $eletype = 'span';
}

class I extends Element {
    protected $eletype = 'i';
}

class Nav extends Element {
    protected $eletype = 'nav';
}

class Template extends Element {
    protected $eletype = 'template';
}

class Img extends Element {
    protected $eletype = 'img';
}
