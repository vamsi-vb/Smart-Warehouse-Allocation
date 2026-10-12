sap.ui.define(
  ["sap/ui/core/Fragment", "sap/ui/model/json/JSONModel", "sap/m/MessageToast"],
  function (Fragment, JSONModel, MessageToast) {
    "use strict";

    return sap.ui.controller("smart.warehouse.fe.v2.ext.controller.ListReportExt", {


    onCreateSalesOrder: function (oEvent) {
        var oView = this.getView();
        if (!this._oCreateDialog) {
          Fragment.load({
            id: oView.getId(),
            name: "smart.warehouse.fe.v2.ext.fragment.CreateSalesOrderDialog",
            controller: this,
          }).then(
            function (oDialog) {
              this._oCreateDialog = oDialog;
              oView.addDependent(this._oCreateDialog);
              this._initDialogModel();
              this._oCreateDialog.open();
            }.bind(this),
          );
        } else {
          this._initDialogModel();
          this._oCreateDialog.open();
        }
      },
      
            _initDialogModel: function () {
            var oModel = new JSONModel({
                CustomerName: "",
                CustomerEmail: "",
                CustomerLatitude: "",
                CustomerLongitude: "",
                Items: []
            });
            this.getView().setModel(oModel, "dialogModel");
        },
          
      
         onAddItem: function (oEvent) {
        var oModel = this.getView().getModel("dialogModel");
        var aItems = oModel.getProperty("/Items");
        aItems.push({
          ProductId: "",
          quantity: "",
        });
        oModel.setProperty("/Items", aItems);
      },

      onDeleteItem: function (oEvent) {
        var oItem = oEvent.getSource().getParent();
        var oContext = oItem.getBindingContext("dialogModel");
        var sPath = oContext.getPath();
        var iIndex = parseInt(sPath.split("/")[2], 10);

        var oModel = this.getView().getModel("dialogModel");
        var aItems = oModel.getProperty("/Items");
        aItems.splice(iIndex, 1);
        oModel.setProperty("/Items", aItems);
      },
      
     

      onCreateDialogCancel: function () {
        this._oCreateDialog.close();
      },

      onCreateDialogSubmit: function () {
        var oModel = this.getView().getModel("dialogModel");
        var oData = oModel.getData();

        if (
          !oData.CustomerName ||
          !oData.CustomerEmail ||
          !oData.CustomerLatitude ||
          !oData.CustomerLongitude
        ) {
          MessageToast.show("Please fill all required header fields.");
          return;
        }

        if (!oData.Items || oData.Items.length === 0) {
          MessageToast.show("Please add at least one item.");
          return;
        }

        for (var i = 0; i < oData.Items.length; i++) {
          var itemQty = parseFloat(oData.Items[i].quantity);
          if (isNaN(itemQty) || itemQty <= 0) {
            MessageToast.show("Quantity must be greater than 0 for all items.");
            return;
          }
        }

        var oODataModel = this.getView().getModel();
        this.getView().setBusy(true);

        var aDeepItemsPromises = oData.Items.map(function (item) {
          return new Promise(function (resolve) {
            if (!item.ProductId) {
              resolve(null);
              return;
            }
            var oFilter = new sap.ui.model.Filter(
              "ProductId",
              sap.ui.model.FilterOperator.EQ,
              item.ProductId,
            );
            oODataModel.read("/Items", {
              filters: [oFilter],
              urlParameters: { $top: "1" },
              success: function (oResponse) {
                var sProductName = item.ProductId; // Default fallback if not found
                if (
                  oResponse &&
                  oResponse.results &&
                  oResponse.results.length > 0
                ) {
                  // Sometimes the field could be null, so fallback to ProductId
                  sProductName =
                    oResponse.results[0].ProductName || item.ProductId;
                }
                resolve({
                  ProductId: item.ProductId,
                  ProductName: sProductName,
                  quantity: parseInt(item.quantity, 10),
                });
              },
              error: function () {
                // On error, just fallback to ProductId
                resolve({
                  ProductId: item.ProductId,
                  ProductName: item.ProductId,
                  quantity: parseInt(item.quantity, 10),
                });
              },
            });
          });
        });

        Promise.all(aDeepItemsPromises).then(
          function (aDeepItems) {
            aDeepItems = aDeepItems.filter(Boolean); // Remove nulls

            var oPayload = {
              IsActiveEntity: true,
              CustomerName: oData.CustomerName,
              CustomerEmail: oData.CustomerEmail,
              CustomerLatitude: parseFloat(oData.CustomerLatitude) || 0,
              CustomerLongitude: parseFloat(oData.CustomerLongitude) || 0,
              item: aDeepItems,
            };

            oODataModel.create("/SalesOrders", oPayload, {
              success: function () {
                this.getView().setBusy(false);
                MessageToast.show("Sales Order created successfully.");
                this._oCreateDialog.close();

                // Refresh the List Report table
                if (this.extensionAPI) {
                  this.extensionAPI.refreshTable();
                } else if (this.getView().byId("listReport")) {
                  this.getView()
                    .byId("listReport")
                    .getBinding("items")
                    .refresh();
                }
              }.bind(this),
              error: function (oError) {
                this.getView().setBusy(false);
                MessageToast.show("Error creating Sales Order.");
                try {
                  var oResponse = JSON.parse(oError.responseText);
                  if (oResponse.error && oResponse.error.message) {
                    MessageToast.show(oResponse.error.message.value);
                  }
                } catch (e) {
                  // ignore
                }
              }.bind(this),
            });
          }.bind(this),
        );
      },
    });
  }
);
