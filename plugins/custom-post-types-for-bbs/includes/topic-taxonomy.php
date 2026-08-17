<?php
/**
 * Topic taxonomy — free-tag, open-ended.
 *
 * Unlike Stage (see stage-taxonomy.php: a fixed, curated set of terms
 * editors pick from but can't add to), Topic is a normal WordPress
 * tag-style taxonomy: editors type new Topic values as they write content,
 * and the term list grows organically. No seeded terms here — deliberately
 * kept apart from Stage per the original Q&A/Resource field spec (Stage and
 * Topic are two separate taxonomies, not flattened into one).
 *
 * Like stage-taxonomy.php, this file deliberately does NOT attach Topic to
 * any post type — each content type's own registration file opts in via
 * register_taxonomy_for_object_type() (currently Q&A Entry and Resource;
 * see qa-entry-cpt.php and resource-cpt.php). To find every content type
 * currently using Topic, search for register_taxonomy_for_object_type(
 * 'topic' — everything using it should live in this plugin, since this
 * plugin owns the content model for the whole site.
 *
 * Load-order note: same as Stage — this file must be required BEFORE any
 * content type's registration file that attaches to 'topic'. Both this file
 * and each CPT hook onto 'init' at the default priority, so require-order
 * (see the main plugin file) is what decides execution order.
 */

function bitesmart_register_topic_taxonomy() {
    register_taxonomy( 'topic', array(), array(
        'labels'            => array(
            'name'          => __( 'Topics', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Topic', 'custom-post-types-for-bbs' ),
            'add_new_item'  => __( 'Add New Topic', 'custom-post-types-for-bbs' ),
            'search_items'  => __( 'Search Topics', 'custom-post-types-for-bbs' ),
        ),
        // Non-hierarchical, free-tag entry (tag-style UI in the editor) —
        // the opposite of Stage's checkbox list on purpose, see file header.
        'hierarchical'      => false,
        'public'            => true,
        'show_in_rest'      => true,
        'rest_base'         => 'topic',
        'show_admin_column' => true,
    ) );
}
add_action( 'init', 'bitesmart_register_topic_taxonomy' );
