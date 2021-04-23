// for testing locally use this:
// import { blockHotLoader } from '../../packages/block-hot-loader/src';
/**
 * External Dependencies
 */

/**
 * WordPress Dependencies
 */
 import { registerBlockType, unregisterBlockType, registerBlockVariation, unregisterBlockVariation } from '@wordpress/blocks';
 import { registerFormatType, unregisterFormatType } from '@wordpress/rich-text';
 import { render, Component, Fragment, createElement } from '@wordpress/element';
 import { registerPlugin, unregisterPlugin } from '@wordpress/plugins';
 import { createReduxStore, dispatch, select, register, registerStore } from '@wordpress/data';
 import { addFilter, removeFilter } from '@wordpress/hooks';
 
 addFilter(
	 'editor.BlockListBlock',
	 'block-editor-hmr/prevent-block-swapping-error',
	 ( BlockListBlock ) => {
		 class ErrorWrapper extends Component {
			 constructor( props ) {
				 super( props );
				 this.state = { hasError: false };
			 }
 
			 static getDerivedStateFromError( error ) {
				 return { hasError: true };
			 }
 
			 componentDidUpdate( prevProps, prevState ) {
				 if ( this.state.hasError && this.state.hasError !== prevState.hasError ) {
					 setTimeout( () => {
						 this.setState( { hasError: false } );
					 } );
				 }
			 }
 
			 render() {
				 if ( this.state.hasError ) {
					 return null;
				 }
				 return createElement(
					 Fragment,
					 null,
					 createElement( BlockListBlock, this.props )
				 );
			 }
		 }
 
		 return ErrorWrapper;
	 }
 );
 
 export const registerBlocks = ( { context: getContext, module } ) => {
	 if ( module.hot ) {
		 let blockModules = {};
		 const loadBlocks = () => {
			 const selectedBlockId = select( 'core/block-editor' ).getSelectedBlockClientId();
 
			 dispatch( 'core/block-editor' ).clearSelectedBlock();
 
			 let blocks = select( 'core/block-editor' ).getBlocks();
 
			 const context = getContext();
			 if ( ! context ) {
				 return;
			 }
 
			 const flatten = ( array ) => {
				 let flat = [];
 
				 if ( !! array ) {
					 for ( let i = 0; i < array.length; i++ ) {
						 flat.push( array[ i ] );
						 if ( ( array[ i ].innerBlocks.constructor === Array ) && ( array[ i ].innerBlocks.length > 0 ) ) {
							 flat = flat.concat( flatten( array[ i ].innerblocks ) );
						 }
					 }
				 }
				 return flat;
			 };
 
			 blocks = blocks.map( ( block, index ) => {
				 const { innerBlocks, name, clientId } = block;
				 const flattenedInnerBlocks = flatten( innerBlocks );
				 block = { name: name, clientId: clientId, innerBlocks: flattenedInnerBlocks, index };
				 return block;
			 } );
 
			 blocks = blocks.map( ( block ) => {
				 const { innerBlocks } = block;
				 switch ( innerBlocks.length ) {
					 case 0:
						 for ( const filePath of context.keys() ) {
							 const module = context( filePath );
							 const name = module.name;
 
							 if ( block.name === name ) {
								 block.updated = ! ( blockModules[ name ] && ( blockModules[ name ].module === module ) );
							 }
						 }
						 return block;
					 default:
						 for ( const innerBlock of innerBlocks ) {
							 for ( const filePath of context.keys() ) {
								 const module = context( filePath );
								 const name = module.name;
 
								 if ( block.name === name ) {
									 block.updated = ! ( blockModules[ name ] && ( blockModules[ name ].module === module ) );
								 }
								 if ( innerBlock.name === name ) {
									 innerBlock.updated = ! ( blockModules[ name ] && ( blockModules[ innerBlock.name ].module === module ) );
								 }
							 }
						 }
						 return block;
				 }
			 } );
 
			 blocks = blocks.map( ( block ) => {
				 const { innerBlocks } = block;
				 if ( innerBlocks.length > 0 ) {
					 block.innerBlocksUpdated = innerBlocks.some( ( innerBlock ) => {
						 return innerBlock.updated === true;
					 } );
				 }
				 return block;
			 } );
 
			 blocks = blocks.filter( ( block ) => {
				 const { innerBlocks } = block;
 
				 switch ( innerBlocks.length ) {
					 case 0:
						 return block.updated;
					 default:
						 if ( ! block.innerBlocksUpdated && ! block.updated ) {
							 return false;
						 }
						 return true;
				 }
			 } );
 
			 for ( const filePath of context.keys() ) {
				 const module = context( filePath );
				 const name = module.name;
 
				 if ( blockModules[ name ] && ( module === blockModules[ name ].module ) ) {
					 const allBlocksUnchanged = blocks.every( ( block ) => {
						 return (
							 ( block.name === name ) &&
							 ( ! block.updated ) &&
							 ( ! block.innerBlocksUpdated )
						 );
					 } );
					 if ( allBlocksUnchanged ) {
						 continue;
					 }
				 }
 
				 // added to fix breaking changes to gutenberg 7.6
				 // keeping just in case we need this again in the future
				 // let prevAttributes = [];
				 // end added
				 if ( blockModules[ name ] ) {
					 const prevModule = blockModules[ name ].module;
 
					 // added to fix breaking changes to gutenberg 7.6
					 // keeping just in case we need this again in the future
					 // blocks.forEach( ( block, index ) => {
					 // 	if( block.name === name && block.updated ) {
					 // 		const { attributes } = getBlock( block.clientId );
					 // 		prevAttributes[ index ] = attributes;
					 // 		removeBlock( block.clientId );
					 // 	}
					 // } );
					 // end added
 
					 unregisterBlockType( prevModule.name );
				 }
 
				 registerBlockType( module.name, module.settings );
 
				 // added to fix breaking changes to gutenberg 7.6
				 // keeping just in case we need this again in the future
				 // blocks.forEach( ( block, index ) => {
				 // 	if( block.name === name && block.updated ) {
				 // 		for( const attribute in module.settings.attributes ) {
				 // 			if( module.settings.attributes[ attribute ] ) {
				 // 				module.settings.attributes[ attribute ].default = prevAttributes[ index ][ attribute ];
				 // 			}
				 // 		}
				 // 		const insertedBlock = createBlock( module.name, module.settings );
				 // 		insertBlock( insertedBlock, block.index );
				 // 	}
				 // } );
				 // end added
 
				 blockModules = {
					 ...blockModules,
					 [ name ]: { filePath, module }
				 };
			 }
 
			 for ( const block of blocks ) {
				 const { clientId, innerBlocks } = block;
				 dispatch( 'core/block-editor' ).selectBlock( clientId );
 
				 for ( const innerBlock of innerBlocks ) {
					 const { clientId: innerBlockClientId } = innerBlock;
					 dispatch( 'core/block-editor' ).selectBlock( innerBlockClientId );
				 }
			 }
 
			 if ( selectedBlockId ) {
				 dispatch( 'core/block-editor' ).selectBlock( selectedBlockId );
			 } else {
				 dispatch( 'core/block-editor' ).clearSelectedBlock();
			 }
 
			 return context;
		 };
		 module.hot.accept( loadBlocks().id, loadBlocks );
	 } else {
		 const context = getContext();
 
		 for ( const filePath of context.keys() ) {
			 const module = context( filePath );
			 const name = module.name;
			 const settings = module.settings;
 
			 registerBlockType( name, settings );
		 }
 
		 return context;
	 }
 }
 
 export const registerFilters = ( { context: getContext,	module } ) => {
	 if ( module.hot ) {
		 let filterModules = {};
		 const loadFilters = () => {
 
			 const context = getContext();
 
			 if ( ! context ) {
				 return;
			 }
 
			 for ( const filePath of context.keys() ) {
				 const module = context( filePath );
				 const name = module.name;
				 const filters = module.filters;
 
				 if ( filterModules[ name ] && ( module === filterModules[ name ].module ) ) {
					 continue;
				 }
 
				 if ( filterModules[ name ] ) {
					 const prevModule = filterModules[ name ].module;
 
					 prevModule.filters.forEach( ( filter ) => {
						 const { hookName, namespace, callback } = filter;
						 removeFilter( hookName, namespace, callback );
					 } );
				 }
 
				 if( !! filters ) {
					 filters.forEach( ( filter ) => {
						 // Adding the filter
						 // addFilter( 'hookName', 'namespace', 'callback', 'priority' )
						 const { hookName, namespace, callback, priority } = filter;
						 addFilter( hookName, namespace, callback, priority );
					 } );
				 }
 
				 filterModules = {
					 ...filterModules,
					 [ name ]: { filePath, module }
				 };
			 }
			 return context;
		 };
		 module.hot.accept( loadFilters().id, loadFilters );
	 } else {
		 const context = getContext();
 
		 for ( const filePath of context.keys() ) {
			 const module = context( filePath );
			 const filters = module.filters;
 
			 filters.forEach( ( filter ) => {
				 // addFilter( 'hookName', 'namespace', 'callback', 'priority' )
				 const { hookName, namespace, callback, priority } = filter;
				 addFilter( hookName, namespace, callback, priority );
			 } );
		 }
 
		 return context;
	 }
 }
 
 export const registerStyles = ( { context: getContext, module } ) => {
	 if ( module.hot ) {
		 let styleModules = {};
		 const loadStyles = () => {
			 const context = getContext();
			 if ( ! context ) {
				 return;
			 }
 
			 for ( const filePath of context.keys() ) {
				 const module = context( filePath );
				 const name = module.name;
				 const styles = module.styles;
 
				 if ( styleModules[ name ] && ( module === styleModules[ name ].module ) ) {
					 continue;
				 }
 
				 if ( styleModules[ name ] ) {
					 const prevModule = styleModules[ name ].module;
 
					 prevModule.styles.forEach( ( style ) => {
						 const { block } = style;
						 unregisterBlockStyle( block, style );
					 } );
				 }
 
				 styles.forEach( ( style ) => {
					 // Adding the style
					 const { block } = style;
					 registerBlockStyle( block, style );
				 } );
 
				 styleModules = { ...styleModules, [ name ]: { filePath: filePath, module: module } };
			 }
			 return context;
		 };
		 module.hot.accept( loadStyles().id, loadStyles );
	 } else {
		 const context = getContext();
 
		 for ( const filePath of context.keys() ) {
			 const module = context( filePath );
			 const styles = module.styles;
 
			 styles.forEach( ( style ) => {
				 const { name } = style;
				 registerBlockStyle( name, style );
			 } );
		 }
 
		 return context;
	 }
 }
 
 export const registerPlugins = ( { context: getContext, module } ) => {
	 if ( module.hot ) {
		 let pluginModules = {};
		 const loadPlugins = () => {
			 const context = getContext();
			 if ( ! context ) {
				 return;
			 }
 
			 for ( const filePath of context.keys() ) {
				 const module = context( filePath );
				 const name = module.name;
				 const settings = module.settings;
 
				 if ( pluginModules[ name ] && ( module === pluginModules[ name ].module ) ) {
					 continue;
				 }
 
				 if ( pluginModules[ name ] ) {
					 const prevModule = pluginModules[ name ].module;
					 unregisterPlugin( prevModule.name );
				 }
 
				 registerPlugin( name, settings );
 
				 pluginModules = {
					 ...pluginModules,
					 [ name ]: { filePath, module }
				 };
			 }
			 return context;
		 };
		 module.hot.accept( loadPlugins().id, loadPlugins );
	 } else {
		 const context = getContext();
 
		 for ( const filePath of context.keys() ) {
			 const module = context( filePath );
			 const name = module.name;
			 const settings = module.settings;
 
			 registerPlugin( name, settings );
		 }
 
		 return context;
	 }
 }
 
 export const registerStores = ( { context: getContext, module } ) => {
	 if ( module.hot ) {
		 let storeModules = {};
		 const loadStore = () => {
			 const context = getContext();
			 if ( ! context ) {
				 return;
			 }
 
			 for ( const filePath of context.keys() ) {
				 const module = context( filePath );
				 const name = module.name;
				 const settings = module.settings;
 
				 if ( storeModules[ name ] && ( module === storeModules[ name ].module ) ) {
					 continue;
				 }
 
				 register( createReduxStore( name, settings ) );
 
				 storeModules = {
					 ...storeModules,
					 [ name ]: { filePath, module }
				 };
			 }
			 return context;
		 };
		 module.hot.accept( loadStore().id, loadStore );
	 } else {
		 const context = getContext();
 
		 for ( const filePath of context.keys() ) {
			 const module = context( filePath );
			 const name = module.name;
			 const settings = module.settings;
 
			 register( createReduxStore( name, settings ) );
		 }
 
		 return context;
	 }
 }
 
 export const registerFrontend = ( { context: getContext, module } ) => {
	 if ( module.hot ) {
		 let frontendModules = {};
		 const loadFrontend = () => {
			 const context = getContext();
			 if ( ! context ) {
				 return;
			 }
 
			 for ( const filePath of context.keys() ) {
				 const module = context( filePath );
				 const name = module.name;
				 const blocks = module.blocks;
				 const blockContainers = module.blockContainers;
 
				 if ( frontendModules[ name ] && ( module === frontendModules[ name ].module ) ) {
					 continue;
				 }
 
				 blockContainers.forEach( ( blockContainer, index ) => {
					 render(
						 blocks[ index ],
						 blockContainer
					 );
				 } );
 
				 frontendModules = {
					 ...frontendModules,
					 [ name ]: { filePath, module }
				 };
			 }
			 return context;
		 };
		 module.hot.accept( loadFrontend().id, loadFrontend );
	 } else {
		 const context = getContext();
 
		 for ( const filePath of context.keys() ) {
			 const module = context( filePath );
			 const blocks = module.blocks;
			 const blockContainers = module.blockContainers;
 
			 blockContainers.forEach( ( blockContainer, index ) => {
				 render(
					 blocks[ index ],
					 blockContainer
				 );
			 } );
		 }
 
		 return context;
	 }
 }
 
 export const registerVariations = ( { context: getContext, module } ) => {
	 if ( module.hot ) {
		 let variationModules = {};
		 const loadVariations = () => {
			 const context = getContext();
			 if ( ! context ) {
				 return;
			 }
 
			 for ( const filePath of context.keys() ) {
				 const module = context( filePath );
				 const name = module.name;
				 const variations = module.variations;
 
				 if ( variationModules[ name ] && ( module === variationModules[ name ].module ) ) {
					 continue;
				 }
 
				 if ( variationModules[ name ] ) {
					 const prevModule = variationModules[ name ].module;
 
					 prevModule.variations.forEach( ( variation ) => {
						 const { name } = variation;
						 unregisterBlockVariation( name, variation );
					 } );
				 }
 
				 variations.forEach( ( variation ) => {
					 // Adding the variation
					 const { name } = variation;
					 registerBlockVariation( name, variation );
				 } );
 
				 variationModules = {
					 ...variationModules,
					 [ name ]: { filePath, module }
				 };
			 }
			 return context;
		 };
		 module.hot.accept( loadVariations().id, loadVariations );
	 } else {
		 const context = getContext();
 
		 for ( const filePath of context.keys() ) {
			 const module = context( filePath );
			 const variations = module.variations;
 
			 variations.forEach( ( variation ) => {
				 const { name } = variation;
				 registerBlockVariation( name, variation );
			 } );
		 }
 
		 return context;
	 }
 }
 
 export const registerFormats = ( { context: getContext, module } ) => {
	 if ( module.hot ) {
		 let formatModules = {};
		 const loadFormats = () => {
			 const context = getContext();
			 if ( ! context ) {
				 return;
			 }
 
			 for ( const filePath of context.keys() ) {
				 const module = context( filePath );
				 const name = module.name;
				 const settings = module.settings;
 
				 if ( formatModules[ name ] && ( module === formatModules[ name ].module ) ) {
					 continue;
				 }
 
				 if ( formatModules[ name ] ) {
					 const prevModule = formatModules[ name ].module;
					 unregisterFormatType( prevModule.name );
				 }
 
				 registerFormatType( name, settings );
 
				 formatModules = {
					 ...formatModules,
					 [ name ]: { filePath, module }
				 };
			 }
			 return context;
		 };
		 module.hot.accept( loadFormats().id, loadFormats );
	 } else {
		 const context = getContext();
 
		 for ( const filePath of context.keys() ) {
			 const module = context( filePath );
			 const name = module.name;
			 const settings = module.settings;
 
			 registerFormatType( name, settings );
		 }
 
		 return context;
	 }
 }
 
 export const registerScripts = ( { context: getContext, module } ) => {
	 if ( module.hot ) {
		 let scriptModules = {};
		 const loadScripts = () => {
			 const context = getContext();
			 if ( ! context ) {
				 return;
			 }
 
			 for ( const filePath of context.keys() ) {
				 const module = context( filePath );
				 const name = module.name;
 
				 if ( scriptModules[ name ] && ( module === scriptModules[ name ].module ) ) {
					 continue;
				 }
 
				 if ( scriptModules[ name ] ) {
					 const prevModule = scriptModules[ name ].module;
				 }
 
				 scriptModules = { ...scriptModules, [ name ]: { filePath: filePath, module: module } };
			 }
			 return context;
		 };
		 module.hot.accept( loadScripts().id, loadScripts );
	 } else {
		 const context = getContext();
 
		 // This looks inocuous but it's super important
		 // This grabs the code for the module from the filepath...
		 // w/o this it does nothing!
		 for ( const filePath of context.keys() ) {
			 const module = context( filePath );
		 }
 
		 return context;
	 }
 }
// for testing locally use this:
// import { blockHotLoader } from '../../packages/block-hot-loader/src';
/**
 * External Dependencies
 */

/**
 * WordPress Dependencies
 */
import { registerBlockType, unregisterBlockType, registerBlockVariation, unregisterBlockVariation } from '@wordpress/blocks';
import { registerFormatType, unregisterFormatType } from '@wordpress/rich-text';
import { render, Component, Fragment, createElement } from '@wordpress/element';
import { registerPlugin, unregisterPlugin } from '@wordpress/plugins';
import { createReduxStore, dispatch, select, register, registerStore } from '@wordpress/data';
import { addFilter, removeFilter } from '@wordpress/hooks';

addFilter(
	'editor.BlockListBlock',
	'block-editor-hmr/prevent-block-swapping-error',
	( BlockListBlock ) => {
		class ErrorWrapper extends Component {
			constructor( props ) {
				super( props );
				this.state = { hasError: false };
			}

			static getDerivedStateFromError( error ) {
				return { hasError: true };
			}

			componentDidUpdate( prevProps, prevState ) {
				if ( this.state.hasError && this.state.hasError !== prevState.hasError ) {
					setTimeout( () => {
						this.setState( { hasError: false } );
					} );
				}
			}

			render() {
				if ( this.state.hasError ) {
					return null;
				}
				return createElement(
					Fragment,
					null,
					createElement( BlockListBlock, this.props )
				);
			}
		}

		return ErrorWrapper;
	}
);

export const registerBlocks = ( { context: getContext, module } ) => {
	if ( module.hot ) {
		let blockModules = {};
		const loadBlocks = () => {
			const selectedBlockId = select( 'core/block-editor' ).getSelectedBlockClientId();

			dispatch( 'core/block-editor' ).clearSelectedBlock();

			let blocks = select( 'core/block-editor' ).getBlocks();

			const context = getContext();
			if ( ! context ) {
				return;
			}

			const flatten = ( array ) => {
				let flat = [];

				if ( !! array ) {
					for ( let i = 0; i < array.length; i++ ) {
						flat.push( array[ i ] );
						if ( ( array[ i ].innerBlocks.constructor === Array ) && ( array[ i ].innerBlocks.length > 0 ) ) {
							flat = flat.concat( flatten( array[ i ].innerblocks ) );
						}
					}
				}
				return flat;
			};

			blocks = blocks.map( ( block, index ) => {
				const { innerBlocks, name, clientId } = block;
				const flattenedInnerBlocks = flatten( innerBlocks );
				block = { name: name, clientId: clientId, innerBlocks: flattenedInnerBlocks, index };
				return block;
			} );

			blocks = blocks.map( ( block ) => {
				const { innerBlocks } = block;
				switch ( innerBlocks.length ) {
					case 0:
						for ( const filePath of context.keys() ) {
							const module = context( filePath );
							const name = module.name;

							if ( block.name === name ) {
								block.updated = ! ( blockModules[ name ] && ( blockModules[ name ].module === module ) );
							}
						}
						return block;
					default:
						for ( const innerBlock of innerBlocks ) {
							for ( const filePath of context.keys() ) {
								const module = context( filePath );
								const name = module.name;

								if ( block.name === name ) {
									block.updated = ! ( blockModules[ name ] && ( blockModules[ name ].module === module ) );
								}
								if ( innerBlock.name === name ) {
									innerBlock.updated = ! ( blockModules[ name ] && ( blockModules[ innerBlock.name ].module === module ) );
								}
							}
						}
						return block;
				}
			} );

			blocks = blocks.map( ( block ) => {
				const { innerBlocks } = block;
				if ( innerBlocks.length > 0 ) {
					block.innerBlocksUpdated = innerBlocks.some( ( innerBlock ) => {
						return innerBlock.updated === true;
					} );
				}
				return block;
			} );

			blocks = blocks.filter( ( block ) => {
				const { innerBlocks } = block;

				switch ( innerBlocks.length ) {
					case 0:
						return block.updated;
					default:
						if ( ! block.innerBlocksUpdated && ! block.updated ) {
							return false;
						}
						return true;
				}
			} );

			for ( const filePath of context.keys() ) {
				const module = context( filePath );
				const name = module.name;

				if ( blockModules[ name ] && ( module === blockModules[ name ].module ) ) {
					const allBlocksUnchanged = blocks.every( ( block ) => {
						return (
							( block.name === name ) &&
							( ! block.updated ) &&
							( ! block.innerBlocksUpdated )
						);
					} );
					if ( allBlocksUnchanged ) {
						continue;
					}
				}

				// added to fix breaking changes to gutenberg 7.6
				// keeping just in case we need this again in the future
				// let prevAttributes = [];
				// end added
				if ( blockModules[ name ] ) {
					const prevModule = blockModules[ name ].module;

					// added to fix breaking changes to gutenberg 7.6
					// keeping just in case we need this again in the future
					// blocks.forEach( ( block, index ) => {
					// 	if( block.name === name && block.updated ) {
					// 		const { attributes } = getBlock( block.clientId );
					// 		prevAttributes[ index ] = attributes;
					// 		removeBlock( block.clientId );
					// 	}
					// } );
					// end added

					unregisterBlockType( prevModule.name );
				}

				registerBlockType( module.name, module.settings );

				// added to fix breaking changes to gutenberg 7.6
				// keeping just in case we need this again in the future
				// blocks.forEach( ( block, index ) => {
				// 	if( block.name === name && block.updated ) {
				// 		for( const attribute in module.settings.attributes ) {
				// 			if( module.settings.attributes[ attribute ] ) {
				// 				module.settings.attributes[ attribute ].default = prevAttributes[ index ][ attribute ];
				// 			}
				// 		}
				// 		const insertedBlock = createBlock( module.name, module.settings );
				// 		insertBlock( insertedBlock, block.index );
				// 	}
				// } );
				// end added

				blockModules = {
					...blockModules,
					[ name ]: { filePath, module }
				};
			}

			for ( const block of blocks ) {
				const { clientId, innerBlocks } = block;
				dispatch( 'core/block-editor' ).selectBlock( clientId );

				for ( const innerBlock of innerBlocks ) {
					const { clientId: innerBlockClientId } = innerBlock;
					dispatch( 'core/block-editor' ).selectBlock( innerBlockClientId );
				}
			}

			if ( selectedBlockId ) {
				dispatch( 'core/block-editor' ).selectBlock( selectedBlockId );
			} else {
				dispatch( 'core/block-editor' ).clearSelectedBlock();
			}

			return context;
		};
		module.hot.accept( loadBlocks().id, loadBlocks );
	} else {
		const context = getContext();

		for ( const filePath of context.keys() ) {
			const module = context( filePath );
			const name = module.name;
			const settings = module.settings;

			registerBlockType( name, settings );
		}

		return context;
	}
}

export const registerFilters = ( { context: getContext,	module } ) => {
	if ( module.hot ) {
		let filterModules = {};
		const loadFilters = () => {

			const context = getContext();

			if ( ! context ) {
				return;
			}

			for ( const filePath of context.keys() ) {
				const module = context( filePath );
				const name = module.name;
				const filters = module.filters;

				if ( filterModules[ name ] && ( module === filterModules[ name ].module ) ) {
					continue;
				}

				if ( filterModules[ name ] ) {
					const prevModule = filterModules[ name ].module;

					prevModule.filters.forEach( ( filter ) => {
						const { hookName, namespace, callback } = filter;
						removeFilter( hookName, namespace, callback );
					} );
				}

				if( !! filters ) {
					filters.forEach( ( filter ) => {
						// Adding the filter
						// addFilter( 'hookName', 'namespace', 'callback', 'priority' )
						const { hookName, namespace, callback, priority } = filter;
						addFilter( hookName, namespace, callback, priority );
					} );
				}

				filterModules = {
					...filterModules,
					[ name ]: { filePath, module }
				};
			}
			return context;
		};
		module.hot.accept( loadFilters().id, loadFilters );
	} else {
		const context = getContext();

		for ( const filePath of context.keys() ) {
			const module = context( filePath );
			const filters = module.filters;

			filters.forEach( ( filter ) => {
				// addFilter( 'hookName', 'namespace', 'callback', 'priority' )
				const { hookName, namespace, callback, priority } = filter;
				addFilter( hookName, namespace, callback, priority );
			} );
		}

		return context;
	}
}

export const registerStyles = ( { context: getContext, module } ) => {
	if ( module.hot ) {
		let styleModules = {};
		const loadStyles = () => {
			const context = getContext();
			if ( ! context ) {
				return;
			}

			for ( const filePath of context.keys() ) {
				const module = context( filePath );
				const name = module.name;
				const styles = module.styles;

				if ( styleModules[ name ] && ( module === styleModules[ name ].module ) ) {
					continue;
				}

				if ( styleModules[ name ] ) {
					const prevModule = styleModules[ name ].module;

					prevModule.styles.forEach( ( style ) => {
						const { block } = style;
						unregisterBlockStyle( block, style );
					} );
				}

				styles.forEach( ( style ) => {
					// Adding the style
					const { block } = style;
					registerBlockStyle( block, style );
				} );

				styleModules = { ...styleModules, [ name ]: { filePath: filePath, module: module } };
			}
			return context;
		};
		module.hot.accept( loadStyles().id, loadStyles );
	} else {
		const context = getContext();

		for ( const filePath of context.keys() ) {
			const module = context( filePath );
			const styles = module.styles;

			styles.forEach( ( style ) => {
				const { name } = style;
				registerBlockStyle( name, style );
			} );
		}

		return context;
	}
}

export const registerPlugins = ( { context: getContext, module } ) => {
	if ( module.hot ) {
		let pluginModules = {};
		const loadPlugins = () => {
			const context = getContext();
			if ( ! context ) {
				return;
			}

			for ( const filePath of context.keys() ) {
				const module = context( filePath );
				const name = module.name;
				const settings = module.settings;

				if ( pluginModules[ name ] && ( module === pluginModules[ name ].module ) ) {
					continue;
				}

				if ( pluginModules[ name ] ) {
					const prevModule = pluginModules[ name ].module;
					unregisterPlugin( prevModule.name );
				}

				registerPlugin( name, settings );

				pluginModules = {
					...pluginModules,
					[ name ]: { filePath, module }
				};
			}
			return context;
		};
		module.hot.accept( loadPlugins().id, loadPlugins );
	} else {
		const context = getContext();

		for ( const filePath of context.keys() ) {
			const module = context( filePath );
			const name = module.name;
			const settings = module.settings;

			registerPlugin( name, settings );
		}

		return context;
	}
}

export const registerStores = ( { context: getContext, module } ) => {
	if ( module.hot ) {
		let storeModules = {};
		const loadStore = () => {
			const context = getContext();
			if ( ! context ) {
				return;
			}

			for ( const filePath of context.keys() ) {
				const module = context( filePath );
				const name = module.name;
				const settings = module.settings;

				if ( storeModules[ name ] && ( module === storeModules[ name ].module ) ) {
					continue;
				}

				register( createReduxStore( name, settings ) );

				storeModules = {
					...storeModules,
					[ name ]: { filePath, module }
				};
			}
			return context;
		};
		module.hot.accept( loadStore().id, loadStore );
	} else {
		const context = getContext();

		for ( const filePath of context.keys() ) {
			const module = context( filePath );
			const name = module.name;
			const settings = module.settings;

			register( createReduxStore( name, settings ) );
		}

		return context;
	}
}

export const registerFrontend = ( { context: getContext, module } ) => {
	if ( module.hot ) {
		let frontendModules = {};
		const loadFrontend = () => {
			const context = getContext();
			if ( ! context ) {
				return;
			}

			for ( const filePath of context.keys() ) {
				const module = context( filePath );
				const name = module.name;
				const blocks = module.blocks;
				const blockContainers = module.blockContainers;

				if ( frontendModules[ name ] && ( module === frontendModules[ name ].module ) ) {
					continue;
				}

				blockContainers.forEach( ( blockContainer, index ) => {
					render(
						blocks[ index ],
						blockContainer
					);
				} );

				frontendModules = {
					...frontendModules,
					[ name ]: { filePath, module }
				};
			}
			return context;
		};
		module.hot.accept( loadFrontend().id, loadFrontend );
	} else {
		const context = getContext();

		for ( const filePath of context.keys() ) {
			const module = context( filePath );
			const blocks = module.blocks;
			const blockContainers = module.blockContainers;

			blockContainers.forEach( ( blockContainer, index ) => {
				render(
					blocks[ index ],
					blockContainer
				);
			} );
		}

		return context;
	}
}

export const registerVariations = ( { context: getContext, module } ) => {
	if ( module.hot ) {
		let variationModules = {};
		const loadVariations = () => {
			const context = getContext();
			if ( ! context ) {
				return;
			}

			for ( const filePath of context.keys() ) {
				const module = context( filePath );
				const name = module.name;
				const variations = module.variations;

				if ( variationModules[ name ] && ( module === variationModules[ name ].module ) ) {
					continue;
				}

				if ( variationModules[ name ] ) {
					const prevModule = variationModules[ name ].module;

					prevModule.variations.forEach( ( variation ) => {
						const { name } = variation;
						unregisterBlockVariation( name, variation );
					} );
				}

				variations.forEach( ( variation ) => {
					// Adding the variation
					const { name } = variation;
					registerBlockVariation( name, variation );
				} );

				variationModules = {
					...variationModules,
					[ name ]: { filePath, module }
				};
			}
			return context;
		};
		module.hot.accept( loadVariations().id, loadVariations );
	} else {
		const context = getContext();

		for ( const filePath of context.keys() ) {
			const module = context( filePath );
			const variations = module.variations;

			variations.forEach( ( variation ) => {
				const { name } = variation;
				registerBlockVariation( name, variation );
			} );
		}

		return context;
	}
}

export const registerFormats = ( { context: getContext, module } ) => {
	if ( module.hot ) {
		let formatModules = {};
		const loadFormats = () => {
			const context = getContext();
			if ( ! context ) {
				return;
			}

			for ( const filePath of context.keys() ) {
				const module = context( filePath );
				const name = module.name;
				const settings = module.settings;

				if ( formatModules[ name ] && ( module === formatModules[ name ].module ) ) {
					continue;
				}

				if ( formatModules[ name ] ) {
					const prevModule = formatModules[ name ].module;
					unregisterFormatType( prevModule.name );
				}

				registerFormatType( name, settings );

				formatModules = {
					...formatModules,
					[ name ]: { filePath, module }
				};
			}
			return context;
		};
		module.hot.accept( loadFormats().id, loadFormats );
	} else {
		const context = getContext();

		for ( const filePath of context.keys() ) {
			const module = context( filePath );
			const name = module.name;
			const settings = module.settings;

			registerFormatType( name, settings );
		}

		return context;
	}
}

export const registerScripts = ( { context: getContext, module } ) => {
	if ( module.hot ) {
		let scriptModules = {};
		const loadScripts = () => {
			const context = getContext();
			if ( ! context ) {
				return;
			}

			for ( const filePath of context.keys() ) {
				const module = context( filePath );
				const name = module.name;

				if ( scriptModules[ name ] && ( module === scriptModules[ name ].module ) ) {
					continue;
				}

				if ( scriptModules[ name ] ) {
					const prevModule = scriptModules[ name ].module;
				}

				scriptModules = { ...scriptModules, [ name ]: { filePath: filePath, module: module } };
			}
			return context;
		};
		module.hot.accept( loadScripts().id, loadScripts );
	} else {
		const context = getContext();

		// This looks inocuous but it's super important
		// This grabs the code for the module from the filepath...
		// w/o this it does nothing!
		for ( const filePath of context.keys() ) {
			const module = context( filePath );
		}

		return context;
	}
}
 