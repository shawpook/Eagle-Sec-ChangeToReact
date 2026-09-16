var fieldMap = {
    3: { name: "OBJECT_TYPE_REFERENCE" },
    4: { name: "OBJECT_ATTRIBUTE_REFERENCE" },
    5: { name: "OBJECT_NAME" },
    7: { name: "EDIT_STATUS" },
    8: { name: "EDITORIAL_UPDATE" },
    10: { name: "URGENCY" },
    12: { name: "SUBJECT_REFERENCE" },
    15: { name: "CATEGORY" },
    20: { name: "SUPPLEMENTAL_CATEGORIES", repeatable: true },
    22: { name: "FIXTURE_ID", repeatable: true },
    25: { name: "KEYWORDS", repeatable: true },
    26: { name: "CONTENT_LOCATION_CODE", repeatable: true },
    27: { name: "CONTENT_LOCATION_NAME", repeatable: true },
    30: { name: "RELEASE_DATE" },
    35: { name: "RELEASE_TIME" },
    37: { name: "EXPIRATION_DATE" },
    38: { name: "EXPIRATION_TIME" },
    40: { name: "SPECIAL_INSTRUCTIONS" },
    42: { name: "ACTION_ADVISED" },
    45: { name: "REFERENCE_SERVICE", repeatable: true },
    47: { name: "REFERENCE_DATE", repeatable: true },
    50: { name: "REFERENCE_NUMBER", repeatable: true },
    55: { name: "DATE_CREATED", format: "date" },
    60: { name: "TIME_CREATED", format: "time" },
    62: { name: "DIGITAL_DATE_CREATED", format: "date" },
    63: { name: "DIGITAL_TIME_CREATED", format: "time" },
    65: { name: "ORIGINATING_PROGRAM" },
    70: { name: "PROGRAM_VERSION" },
    75: { name: "OBJECT_CYCLE" },
    80: { name: "BY_LINE", repeatable: true },
    84: { name: "CAPTION" }, // not in spec, but observed in situ
    85: { name: "BY_LINE_TITLE", repeatable: true },
    90: { name: "CITY" },
    92: { name: "SUB_LOCATION" },
    95: { name: "PROVINCE_OR_STATE" },
    100: { name: "COUNTRY_OR_PRIMARY_LOCATION_CODE" },
    101: { name: "COUNTRY_OR_PRIMARY_LOCATION_NAME" },
    103: { name: "ORIGINAL_TRANSMISSION_REFERENCE" },
    105: { name: "HEADLINE" },
    110: { name: "CREDIT" },
    115: { name: "SOURCE" },
    116: { name: "COPYRIGHT_NOTICE" },
    118: { name: "CONTACT" },
    120: { name: "CAPTION" },
    121: { name: "LOCAL_CAPTION" },
    122: { name: "CAPTION_WRITER", repeatable: true },
    125: { name: "RASTERIZED_CAPTION" },
    130: { name: "IMAGE_TYPE" },
    131: { name: "IMAGE_ORIENTATION" },
    135: { name: "LANGUAGE_IDENTIFIER" },
    150: { name: "AUDIO_TYPE" },
    151: { name: "AUDIO_SAMPLING_RATE" },
    152: { name: "AUDIO_SAMPLING_RESOLUTION" },
    153: { name: "AUDIO_DURATION" },
    154: { name: "AUDIO_OUTCUE" },

    184: { name: "JOB_ID" },
    185: { name: "MASTER_DOCUMENT_ID" },
    186: { name: "SHORT_DOCUMENT_ID" },
    187: { name: "UNIQUE_DOCUMENT_ID" },
    188: { name: "OWNER_ID" },

    200: { name: "OBJECT_PREVIEW_FILE_FORMAT" },
    201: { name: "OBJECT_PREVIEW_FILE_FORMAT_VERSION" },
    202: { name: "OBJECT_PREVIEW_DATA" }
},
field_delimiter = 28,
text_start_marker = 2,
options = {
    encoding: 'utf-8'
};

module.exports = function(buffer, incoming_options) {

    // check for jpeg magic bytes header
    if (buffer[0] != 0xFF || buffer[1] != 0xD8) {
        return undefined; // it is not a valid jpeg
    }

    if (incoming_options) {
        options = {
            ...options,
            ...incoming_options
        }
    }

    var offset = 2;
    // Loop through the file looking for the photoshop header bytes
    while (offset < buffer.length) {
        if (buffer[offset] != 0xFF) {
            //console.log("Not a valid marker at offset " + offset + ", found: " + buffer[offset]);
            return false;
        }

        var applicationMarker = buffer[offset + 1];

        if (applicationMarker == 237) {
            // This is our marker. The content length is 2 byte number.
            return readIPTCData(buffer, offset + 4, buffer.readUInt16BE(offset + 2));
        } else {
            // Add header length (2 bytes after header type) to offset
            offset += 2 + buffer.readUInt16BE(offset + 2);
        }
    }
}


function readIPTCData(buffer, start, length) {
    var data = {};

    if (getString(buffer, start, 13) != "Photoshop 3.0") {
        //console.log("Not valid Photoshop data: " + getString(buffer, start, 13));
        return false;
    }

    // There are tons of other potentially useful blocks that could be processed here
    // but are currently discarded.
    extractBlocks(buffer, start + 13, length).forEach(function(block) {
        // Process IPTC-NAA block 0x0404 (1028)
        if (block.resourceId == 1028) {
            //console.log(block)
            var fields = extractIPTCFieldsFromBlock(buffer, block.startOfBlock, block.sizeOfBlock);
            var date, time

            fields.forEach(function(field) {

                //console.log(field)
                if (field.id in fieldMap) {
                    if (field.id == 55) date = field.value;
                    if (field.id == 60) time = field.value;

                    var name = fieldMap[field.id].name.toLowerCase();
                    var val = field.value;

                    if (fieldMap[field.id].repeatable) {
                        if (name in data) {
                            data[name].push(val);
                        } else {
                            data[name] = [val];
                        }
                    } else {
                        data[name] = val;
                    }
                }
            });

            // Construct a real datetime
            if (date && time) {
                try {
                    data['date_time'] = new Date(Date.UTC(
                        parseInt(date.slice(0, 4)),
                        parseInt(date.slice(4, 6)) - 1,
                        parseInt(date.slice(6, 8)),
                        parseInt(time.slice(0, 2)),
                        parseInt(time.slice(2, 4)),
                        parseInt(time.slice(4, 6)),
                        0
                    ));

                } catch (dateErr) { console.log(dateErr); }
            }
        }
    });

    return data;
}

function extractIPTCFieldsFromBlock(buffer, start, length) {
    var end = Math.min(buffer.length, start + length);
    var data = [];

    for (var i = start; i < end; i++) {
        if (buffer[i] == text_start_marker) {

            // Get the length by finding the next field seperator
            var length = 0;
            while (
                i + length < end &&
                buffer[i + length] != field_delimiter &&
                (length < 4 || buffer[i + length + 1] != text_start_marker)) {
                length++;
            }

            //console.log(buffer[i + 1] + ' - ' + length)
            if (length == 0) continue;

            // Convert bytes to string and yield
            data.push({
                id: buffer[i + 1],
                value: getString(buffer, i + 4, length - 4)
            });
            i += length - 1;
        }
    }

    return data;
}

function extractBlocks(buffer, start, length) {

    var blocks = [];
    var end = Math.min(buffer.length, start + length);

    for (var i = start; i < end; i++) {
        // Signature: '8BIM'
        if (buffer[i + 0] == 56 &&
            buffer[i + 1] == 66 &&
            buffer[i + 2] == 73 &&
            buffer[i + 3] == 77) {

            // Resource ID is 2 bytes, so use u16BE
            var resoureceId = buffer.readInt16BE(i + 4);
            // Name: Pascal string, padded to make the size even
            var nameLength = 2;
            // Search for the end of a null-terminated string
            while (nameLength < end - i && buffer[i + 6 + nameLength] != 0x0) {
                nameLength++;
            }

            var name = getString(buffer, i + 6, nameLength);

            var blockSize = buffer.readInt32BE(i + 6 + nameLength);

            blocks.push({
                resourceId: resoureceId,
                name: name,
                startOfBlock: i + 6 + nameLength + 2,
                sizeOfBlock: blockSize + 2
                //,rawBlockValue: getString(buffer, i + 6 + nameLength + 2, blockSize+2000)
            });
        }
    }
    return blocks;
}



function getString(buffer, offset, length) {
    var strBuffer = buffer.slice(offset, offset + length);
    return strBuffer.toString("utf8")
};