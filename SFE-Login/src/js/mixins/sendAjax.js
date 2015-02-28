module.exports = {
    sendAjax: function(type, url, data) {
        return $.ajax({
            type: type,
            url: url,
            data: data
        });
    }
};