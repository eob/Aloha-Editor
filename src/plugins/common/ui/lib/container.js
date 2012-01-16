/**
 * Defines a `Container` Class.
 */

define([
	'aloha/core',
	'aloha/jquery',
	'util/class'
], function( Aloha, jQuery, Class ) {
	'use strict';

	/**
	 * This object provides a unique associative container which maps hashed
	 * `showOn` values (see `generateKeyForShowOnValue()`) with objects that
	 * hold a corresponding `shouldShow` function (which is also derived from
	 * the `showOn` value), and an array of containers which share this
	 * predicate.  The main advantage we get from a hash set is that lookups
	 * can be done in constant time.
	 * @type {object.<string, object>}
	 */
	var showGroups = {};

	/**
	 * Given a `showOn` value, generate a string from a concatenation of its
	 * type and value.  We need to include the typeof of the `showOn` value onto
	 * the returned string so that we can distinguish a value of "true"
	 * (string) and a value `true` (boolean) which would be coerced to
	 * different `shouldShow` functions but would otherwise be stringified as
	 * simply "true".
	 * @param {string|boolean|function():boolean} showOn
	 * @return {string} A key that distinguishes the type and value of the
	 *                  given `showOn` value.  eg: "boolean:true".
	 */
	function generateKeyForShowOnValue( showOn ) {
		return jQuery.type( showOn ) + ':' + showOn.toString();
	};

	/**
	 * Place the a container into the appropriate group in the `showGroups`
	 * hash.  Containers with functionally equivalent `showOn` values are
	 * grouped together so that instead of having to perform N number of tests
	 * to determine whether N number of containers should be shown or hidden,
	 * we can instead perform 1 test for N number of containers in many cases.
	 * @param {Aloha.ui.Container} container
	 */
	function addToShowGroup( container ) {
		var key = generateKeyForShowOnValue( container.showOn );
		var group = showGroups[ key ];

		if ( group ) {
			group.containers.push( container );
		} else {
			group = showGroups[ key ] = {
				shouldShow: coerceShowOnToPredicate( container.showOn ),
				containers: [ container ]
			};
		}

		container.shouldShow = group.shouldShow;
	};

	/**
	 * Given a value which represents a `showOn` test, coerce the value into a
	 * predicate function.
	 * @param {string|boolean|function():boolean} showOn
	 * @return {function():boolean}
	 */
	function coerceShowOnToPredicate( showOn ) {
		switch( jQuery.type( showOn ) ) {
		case 'function':
			return showOn;
		case 'boolean':
			return function() {
				return showOn;
			};
		case 'string':
			return function( el ) {
				return el ? jQuery( el ).is( showOn ) : false;
			};
		case 'undefined':
			return function() {
				return true;
			};
		default:
			return function() {
				return false;
			};
		}
	};

	/**
	 * Show or hide a set of containers.
	 * @param {Array.<Aloha.ui.Container>} containers
	 * @param {string} action Either "hide" or "show", and nothing else.
	 */
	function toggleContainers( containers, action ) {
		if ( action != 'show' && action != 'hide' ) {
			return;
		}

		var j = containers.length;

		while ( j ) {
			containers[ --j ][ action ]();
		}
	};

	// ------------------------------------------------------------------------
	// "Public" methods, and properties
	// ------------------------------------------------------------------------

	var Container = Class.extend({

		/**
		 * Whether this container is visible of not.
		 * @type {boolean}
		 */
		visible: true,

		/**
		 * The containing (wrapper) element for this container.
		 * @type {jQuery<HTMLElement>}
		 */
		element: null,

		/**
		 * True if this tab is activated (ie: having focus, so that not only is
		 * it visible but also top-most, exposing its components for
		 * interaction).
		 * @type {boolean}
		 */
		activated: false,

		/**
		 * A value to test whether this container should be shown when its
		 * `shouldShow` method is invoked.
		 * @param {string|boolean|function():boolean}
		 */
		showOn: true,

		/**
		 * A predicate that tests whether this container should be shown.  This
		 * is done by testing the elements in the current selected range against
		 * the `showOn` value.
		 * @param {Array.<HTMLElement>=} elements A set of elements to test.
		 * @return {boolean} True if this container should be made visible.
		 */
		shouldShow: function() {
			return true;
		},

		/**
		 * Initialize a new container with the specified properties.
		 * @param {object=} settings Optional properties, and override methods.
		 * @constructor
		 */
		_constructor: function( settings ) {
			this.showOn = settings.showOn;
			addToShowGroup( this );
		},

		/**
		 * @return {jQuery<HTMLElement>} The element representing the rendered
		 *                               container.
		 */
		render: function() {
			this.element = jQuery( '<div>', {
				'class': 'aloha-ui-container'
			});

			return this.element;
		},

		show: function() {
			this.element.show();
			this.visible = true;
		},

		hide: function() {
			this.element.hide();
			this.visible = false;
		}
	});

	/**
	 * Given an array of elements, show all containers whose group's
	 * `shouldShow` function returns true for any of the nodes in the `elements`
	 * array.  Otherwise hide those containers.
	 *
	 * We test a group of containers instead of individual containers because,
	 * if we were to test each container's `shouldShow` function individually,
	 * we would do so at a cost of O(num_of_elements * N) in any and all cases.
	 * But by grouping containers into sets that have functionally equivalent
	 * `showOn` conditions, we can minimize the work we have to do for most
	 * cases, since it is likely that there will often be containers which have
	 * the same condition regarding when they are to be shown.
	 *
	 * Organizing our data in this way allows this function to perform 1 *
	 * (number of elements) `shouldShow` test for N containers in most cases,
	 * rather than N * (number of elements) tests for N containers in all
	 * cases.
	 * @TODO(petro): Figure out a way to leave out containers which belong in
	 *               deactivated (hidden) toolbars from being shown, since this
	 *               is unnecessary work.
	 * @param {Array.<HTMLElement>} elements The effective elements any of
	 *                                       which may cause the container to
	 *                                       shown.
	 * @static
	 */
	Container.showContainersForElements = function( elements ) {
		// Add a null object to the elements array so that we can test whether
		// the panel should be activated when we have no effective elements in
		// the current selection.
		if ( elements && jQuery.type( elements.push ) == 'function' ) {
			elements.push( null );
		} else {
			elements = [ null ];
		}

		var group,
		    groupKey,
		    shouldShow,
		    j,
		    show;

		for ( groupKey in showGroups ) {
			group = showGroups[ groupKey ];
			shouldShow = group.shouldShow;

			if ( !shouldShow ) {
				continue;
			}

			j = elements.length;
			show = false;

			while ( j ) {
				var element = elements[ j - 1 ];

				if ( shouldShow( elements[ --j ] ) ) {
					show = true;
					break;
				}
			}

			toggleContainers( group.containers, show ? 'show' : 'hide' );
		}
	};

	return Container;
});
