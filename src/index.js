import _ from 'lodash';
import createError from 'create-error';

/** Thrown when mapOne does not find an object in the resultSet and "isRequired" is passed in as true */
let NotFoundError = createError('NotFoundError');

/**
 * Maps a resultSet to an array of objects.
 *
 * @param {Array} resultSet - an array of database results
 * @param {Array} maps - an array of result maps
 * @param {String} mapId - mapId of the top-level objects in the resultSet
 * @param {String} [columnPrefix] - prefix that should be applied to the column names of the top-level objects
 * @returns {Array} array of mapped objects
 */
function map(resultSet, maps, mapId, columnPrefix) {

    let mappedCollection = [];

    _.each(resultSet, function(result) {
        injectResultInCollection(result, mappedCollection, maps, mapId, columnPrefix);
    });

    return mappedCollection;
}

/**
 * Maps a resultSet to a single object.
 *
 * Although the result is a single object, resultSet may have multiple results (e.g. when the
 * top-level object has many children in a one-to-many relationship). So mapOne() must still
 * call map(), only difference is that it will return only the first result.
 *
 * @param {Array} resultSet - an array of database results
 * @param {Array} maps - an array of result maps
 * @param {String} mapId - mapId of the top-level object in the resultSet
 * @param {String} [columnPrefix] - prefix that should be applied to the column names of the top-level object
 * @param {boolean} [isRequired] - is it required to have a mapped object as a return value? Default is true.
 * @returns {Object} one mapped object or null
 * @throws {NotFoundError} if object is not found and isRequired is true
 */
function mapOne(resultSet, maps, mapId, columnPrefix, isRequired) {

    // Set up a default value for isRequired
    if (isRequired === undefined) {
        isRequired = true;
    }

    var mappedCollection = map(resultSet, maps, mapId, columnPrefix);

    if (mappedCollection.length > 0) {
        return mappedCollection[0];
    }
    else if (isRequired) {
        throw new NotFoundError('EmptyResponse');
    }
    else {
        return null;
    }
}

/**
 * Maps a single database result to a single object using mapId and injects it into mappedCollection.
 *
 * @param {Object} result - a single database result (one row)
 * @param {Array} mappedCollection - the collection in which the mapped object should be injected.
 * @param {Array} maps - an array of result maps
 * @param {String} mapId - mapId of the top-level objects in the resultSet
 * @param {String} [columnPrefix] - prefix that should be applied to the column names of the top-level objects
 */
function injectResultInCollection(result, mappedCollection, maps, mapId, columnPrefix) {

    // Set up a default value for columnPrefix
    if (columnPrefix === undefined) {
        columnPrefix = '';
    }

    // Check if the object is already in mappedCollection
    let resultMap = _.find(maps, 'mapId', mapId);
    let idProperty = getIdProperty(resultMap);
    let mappedObject = _.find(mappedCollection, idProperty.name, result[columnPrefix + idProperty.column]);

    // Create mappedObject if it does not exist in mappedCollection
    if (!mappedObject) {
        mappedObject = createMappedObject(resultMap);
        mappedCollection.push(mappedObject);
    }

    // Inject result in object
    injectResultInObject(result, mappedObject, maps, mapId, columnPrefix);
}

/**
 * Injects id, properties, associations and collections to the supplied mapped object.
 *
 * @param {Object} result - a single database result (one row)
 * @param {Object} mappedObject - the object in which result needs to be injected
 * @param {Array} maps - an array of result maps
 * @param {String} mapId - mapId of the top-level objects in the resultSet
 * @param {String} [columnPrefix] - prefix that should be applied to the column names of the top-level objects
 */
function injectResultInObject(result, mappedObject, maps, mapId, columnPrefix) {

    // Set up a default value for columnPrefix
    if (columnPrefix === undefined) {
        columnPrefix = '';
    }

    // Get the resultMap for this object
    let resultMap = _.find(maps, 'mapId', mapId);

    // Copy id property
    let idProperty = getIdProperty(resultMap);
    if (!mappedObject[idProperty.name]) {
        mappedObject[idProperty.name] = result[columnPrefix + idProperty.column];
    }

    // Copy other properties
    _.each(resultMap.properties, function(property) {
        // If property is a string, convert it to an object
        if (typeof property === 'string') {
            property = {name: property, column: property};
        }

        // Copy only if property does not exist already
        if (!mappedObject[property.name]) {

            // The default for column name is property name
            let column = (property.column) ? property.column : property.name,
                columnValue;

            if (property.fn) {
                columnValue = property.fn(result, columnPrefix);
            } else {
                columnValue = result[columnPrefix + column];                
            }

            mappedObject[property.name] = columnValue;
        }
    });

    // Copy associations
    _.each(resultMap.associations, function(association) {

        let associatedObject = mappedObject[association.name];
        if (!associatedObject) {
            let associatedResultMap = _.find(maps, 'mapId', association.mapId);
            associatedObject = createMappedObject(associatedResultMap);
            mappedObject[association.name] = associatedObject;
        }

        injectResultInObject(result, associatedObject, maps, association.mapId, association.columnPrefix);
    });

    // Copy collections
    _.each(resultMap.collections, function(collection) {

        let mappedCollection = mappedObject[collection.name];
        if (!mappedCollection) {
            mappedCollection = [];
            mappedObject[collection.name] = mappedCollection;
        }

        injectResultInCollection(result, mappedCollection, maps, collection.mapId, collection.columnPrefix);
    });

    // Copy functions
    _lodash2['default'].each(resultMap.fns, function(fn) {
        !_lodash2['default'].isFunction(fn)
            return;

        fn(mappedObject, result);
    });
}

function createMappedObject(resultMap) {
    return (resultMap.createNew) ? resultMap.createNew() : {};
}

function getIdProperty(resultMap) {
    var idProperty = (resultMap.idProperty) ? resultMap.idProperty : {name: 'id', column: 'id'};

    // If property is a string, convert it to an object
    if (typeof idProperty === 'string') {
        idProperty = {name: idProperty, column: idProperty};
    }

    // The default for column name is property name
    if (!idProperty.column) {
        idProperty.column = idProperty.name;
    }

    return idProperty;
}

const joinjs = {
    map: map,
    mapOne: mapOne,
    NotFoundError: NotFoundError
};

export default joinjs;
