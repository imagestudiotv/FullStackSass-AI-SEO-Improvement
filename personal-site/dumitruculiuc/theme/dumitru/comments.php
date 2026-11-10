<?php
/**
 * Comments under a post, when comments are open (Settings → Discussion).
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) || post_password_required() ) {
	return;
}
?>
<div id="comments" class="comments">
	<?php if ( have_comments() ) : ?>
		<h2 class="comments__title">
			<?php
			$dumitru_count = get_comments_number();
			/* translators: %s: number of comments. */
			echo esc_html( sprintf( _n( '%s comment', '%s comments', $dumitru_count, 'dumitru' ), number_format_i18n( $dumitru_count ) ) );
			?>
		</h2>
		<ol class="comments__list">
			<?php
			wp_list_comments(
				array(
					'style'       => 'ol',
					'short_ping'  => true,
					'avatar_size' => 40,
				)
			);
			?>
		</ol>
		<?php the_comments_navigation(); ?>
	<?php endif; ?>

	<?php if ( ! comments_open() && get_comments_number() ) : ?>
		<p class="comments__closed"><?php esc_html_e( 'Comments are closed.', 'dumitru' ); ?></p>
	<?php endif; ?>

	<?php
	comment_form(
		array(
			'class_submit'       => 'key key--orange',
			'title_reply_before' => '<h2 id="reply-title" class="comments__title">',
			'title_reply_after'  => '</h2>',
		)
	);
	?>
</div>
