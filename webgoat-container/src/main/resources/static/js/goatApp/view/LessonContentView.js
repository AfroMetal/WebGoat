//LessonContentView
define(['jquery',
    'underscore',
    'backbone',
    'libs/jquery.form',
    'goatApp/view/ErrorNotificationView',
    'goatApp/view/PaginationControlView'],
    function(
        $,
        _,
        Backbone,
        JQueryForm,
        ErrorNotificationView,
        PaginationControlView) {
    return Backbone.View.extend({
        el:'#lesson-content-wrapper', //TODO << get this fixed up in DOM

        initialize: function(options) {
            options = options || {};
            new ErrorNotificationView();
            var self = this;
            Backbone.on('assignment:navTo', function(assignment){
              var page = self.findPage(assignment);
              if (page != -1) {
                self.navToPage(page);
              }
            });
        },

        findPage: function(assignment) {
          for (var i = 0; i < this.$contentPages.length; i++) {
             var contentPage = this.$contentPages[i];
             var form = $('form.attack-form', contentPage);
             var action = form.attr('action')
             if (action !== undefined && action.includes(assignment.assignment)) {
               return i;
             }
          }
          return -1;
        },

        /* initial rendering */
        render: function() {
            this.$el.find('.lesson-content').html(this.model.get('content'));
            this.$el.find('.attack-feedback').hide();
            this.$el.find('.attack-output').hide();
            this.makeFormsAjax();
            $(window).scrollTop(0); //work-around til we get the scroll down sorted out
            var startPageNum = this.model.get('pageNum');
            this.initPagination(startPageNum);
        },

        initPagination: function(startPageNum) {
            //get basic pagination info
            this.$contentPages = this.$el.find('.lesson-page-wrapper');
            var currentPage = (!isNaN(startPageNum) && startPageNum && startPageNum < this.$contentPages) ? startPageNum : 0;
            //init views & pagination
            this.showCurContentPage(currentPage);
            this.paginationControlView = new PaginationControlView(this.$contentPages,this.model.get('lessonUrl'));
         },

         updatePagination: function() {
            this.paginationControlView.updateCollection();
         },

         getCurrentPage: function () {
            return this.currentPage;
         },

        makeFormsAjax: function () {
            this.$form = $('form.attack-form');
            // turn off standard submit
            var self = this;
            // each submit handled per form
            this.$form.each( function() {
                $(this).submit(self.onFormSubmit.bind(self));
            });
        },

        /* form submission handling */
        onFormSubmit: function (e) {
            var curForm = e.currentTarget; // the form from which the
            var self = this;
            // TODO custom Data prep for submission
            var prepareDataFunctionName = $(curForm).attr('prepareData');
            var callbackFunctionName = $(curForm).attr('callback');
            var submitData = (typeof webgoat.customjs[prepareDataFunctionName] === 'function') ? webgoat.customjs[prepareDataFunctionName]() : $(curForm).serialize();
            var successCallBackFunctionName = $(curForm).attr('successCallback');
            var failureCallbackFunctionName = $(curForm).attr('failureCallback');
            var callbackFunction = (typeof webgoat.customjs[callbackFunctionName] === 'function') ? webgoat.customjs[callbackFunctionName] : function() {};
            // var submitData = this.$form.serialize();
            this.curForm = curForm;
            this.$curFeedback = $(curForm).closest('.attack-container').find('.attack-feedback');
            this.$curOutput = $(curForm).closest('.attack-container').find('.attack-output');

            var formUrl = $(curForm).attr('action');
            var formMethod = $(curForm).attr('method');
            var contentType = ($(curForm).attr('contentType')) ? $(curForm).attr('contentType') : 'application/x-www-form-urlencoded; charset=UTF-8';
            $.ajax({
                //data:submitData,
                url:formUrl,
                method:formMethod,
                contentType:contentType,
                data: submitData,
                //complete: function (data) {
                    //callbackFunction(data);
                //}
            }).then(function(data){
                 self.onSuccessResponse(data, failureCallbackFunctionName, successCallBackFunctionName)}, self.onErrorResponse.bind(self));
            return false;
         },

        onSuccessResponse: function(data, failureCallbackFunctionName, successCallBackFunctionName) {
            this.renderFeedback(data.feedback);
            this.renderOutput(data.output || "");

            //var submitData = (typeof webgoat.customjs[prepareDataFunctionName] === 'function') ? webgoat.customjs[prepareDataFunctionName]() : $(curForm).serialize();
            var successCallbackFunction = (typeof webgoat.customjs[successCallBackFunctionName] === 'function') ? webgoat.customjs[successCallBackFunctionName] : function() {};
            var failureCallbackFunction = (typeof webgoat.customjs[failureCallbackFunctionName] === 'function') ? webgoat.customjs[failureCallbackFunctionName] : function() {};
            //TODO: refactor back assignmentCompleted in Java
            if (data.lessonCompleted || data.assignmentCompleted) {
                this.markAssignmentComplete();
                successCallbackFunction(data); //data is likely not useful, except maybe the output ...
                this.trigger('assignment:complete');
            } else {
                this.markAssignmentIncomplete(data); //again, data might be useful, especially the output
                failureCallbackFunction();
            }
            return false;
        },

        markAssignmentComplete: function () {
            this.curForm.reset();
            $(this.curForm).siblings('.assignment-success').find('i').removeClass('hidden');
            this.paginationControlView.updateCollection();
        },

        markAssignmentIncomplete: function () {
            $(this.curForm).siblings('.assignment-success').find('i').addClass('hidden');
        },

        onErrorResponse: function (a,b,c) {
            console.error(a);
            console.error(b);
            console.error(c);
            return false;
        },

        renderFeedback: function(feedback) {
            this.$curFeedback.html(polyglot.t(feedback) || "");
            this.$curFeedback.show(400)

        },

        renderOutput: function(output) {
            this.$curOutput.html(polyglot.t(output) || "");
            this.$curOutput.show(400)
        },

        showCurContentPage: function(pageNum) {
            this.$contentPages.hide();
            this.$el.find(this.$contentPages[pageNum]).show();
        },

        findAssigmentEndpointsOnPage: function(pageNumber) {
            var contentPage = this.$contentPages[pageNumber];
            var endpoints = []; //going to assume uniqueness since these are assignments
            var pageForms = $(contentPage).find('form.attack-form');
            for (var i=0; i<pageForms.length; i++) {
                endpoints.push(pageForms[i].action);
            }
            console.log(endpoints);
            return endpoints;
        },

        navToPage: function (pageNum) {
            this.paginationControlView.setCurrentPage(pageNum);//provides validation
            this.showCurContentPage(this.paginationControlView.currentPage);
            this.paginationControlView.render();
            this.paginationControlView.hideShowNavButtons();
            var assignmentPaths = this.findAssigmentEndpointsOnPage(pageNum);
            this.trigger('endpoints:filtered',assignmentPaths);
        },

        /* for testing */
        showTestParam: function (param) {
            this.$el.find('.lesson-content').html('test:' + param);
        }

    });

    
});
