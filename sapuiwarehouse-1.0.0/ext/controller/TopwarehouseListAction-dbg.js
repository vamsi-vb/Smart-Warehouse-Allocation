sap.ui.define([
    "sap/ui/core/Fragment"
], function(Fragment) {
    "use strict";


    return {
        onPressTopWarehouse: function() {
            // In Fiori Elements V4, 'this' is the ExtensionAPI
            if (!this._pTopWarehouseDialog) {
                this._pTopWarehouseDialog = this.loadFragment({
                    id: "topWarehouseDialog",
                    name: "sap.ui.warehouse.ext.fragment.Topwarehouse",
                    controller: this // Bind the dialog to this ExtensionAPI
                });
            }

            this._pTopWarehouseDialog.then(function(oDialog) {
                oDialog.open();
            });


        },
        
        onCloseDialog: function(oEvent) {
            oEvent.getSource().getParent().close();
            
        }
    };
});
