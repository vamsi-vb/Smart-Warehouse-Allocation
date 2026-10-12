sap.ui.define([
   "sap/ui/core/mvc/controller",
   "sap/ui/core/routing/history"
], function(controller) {
   "use strict"

   return controller.extend("sap.ui.warehouse.controller.Orderdetails", 
         {
           onnavback: function() {
               let ohistory = history.getInstance();
               let pHash    =  ohistory.getPreviousHash(); 

               if(pHash !== undefined) {
                  window.history.go(-1)
               } else {
                 let oRouter = this.getOwnerComponent().getRouter();
                 oRouter.navTo("salesprder", {}, true);
               }
           }
         }
   )
})