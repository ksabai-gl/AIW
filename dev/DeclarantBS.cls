/*
 * com.qad.logistics.intrastat.DeclarantBS - Business Service Class for Declarant.
 *
 * Copyright 1986 QAD Inc. All rights reserved.
 *
 * $Id: DeclarantBS.cls 402048 2021-12-13 21:35:39Z jpm $ 
 */ 
  
using com.qad.base.BaseMessageKey.
using com.qad.base.BaseUtils.

using com.qad.lang.IList.
using com.qad.lang.List.
using com.qad.lang.Message.

using com.qad.logistics.LogisticsError.
using com.qad.logistics.LogisticsTranslatedString.
using com.qad.logistics.intrastat.DeclarantBE.

using com.qad.qra.QraServices.
using com.qad.qra.base.DataOperations.
using com.qad.qra.core.Utility.
using com.qad.qra.transaction.ITransactionManager.

routine-level on error undo, throw.

class com.qad.logistics.intrastat.DeclarantBS: 

   {com/qad/logistics/intrastat/dsDeclarant.i}
   {com/qad/logistics/intrastat/dsDeclarant.i &PREFIX = "Initial"}
   
   define protected property DeclarantBE as DeclarantBE no-undo 
      protected get. 
      protected set.
      
   define protected property LeaveAsUnknownList as character
      initial "LastModifiedDate,CustomDate0,CustomDate1,CustomDate2,CustomDate3,CustomDate4" no-undo
      get. 
      private set.
   
   constructor public DeclarantBS():

      this-object:DeclarantBE = new DeclarantBE().

   end constructor.

   method public void Create(input dataset dsDeclarant):
       
      define variable valMsgs           as IList               no-undo.
      define variable transManager      as ITransactionManager no-undo.
      define variable err               as LogisticsError      no-undo.
      define variable xid               as character           no-undo.

      define buffer ttDeclarant for ttDeclarant.
      
      valMsgs = new List(Progress.Lang.Class:GetClass("com.qad.lang.IMessage")).

      do on error undo, throw:
         
         dataset dsInitialDeclarant:empty-dataset().

         this-object:DeclarantBE:Initialize(output dataset dsInitialDeclarant by-reference).

         /* Scope order buffers to prevent invalid memory access */
         find first ttInitialDeclarant no-error.

         for each ttDeclarant on error undo, throw:
            
            /* Replace the unknown values in the passed dataset with the initialized dataset,
             * ensuring that the fields designated as read-only overwrite the values
             * in the passed dataset */
            Utility:CopyBufferReplaceUnknowns(buffer ttInitialDeclarant:handle,
                                              buffer ttDeclarant:handle,
                                              "",
                                              this-object:DeclarantBE:ReadOnlyFields).
   
            ttDeclarant.DataOperation = DataOperations:CREATE.
            
         end.
         
         this-object:DeclarantBE:AssignDefaults(input-output dataset dsDeclarant by-reference).

         if not this-object:DeclarantBE:IsValid(input dataset dsDeclarant by-reference, output valMsgs) then
            undo, throw new LogisticsError(valMsgs).

         transManager = QraServices:GetTransactionManager().

         xid = transManager:StartTransaction().

         do on error undo, throw:

            this-object:DeclarantBE:Commit(dataset dsDeclarant by-reference).

            transManager:Commit(xid).

            catch e as Progress.Lang.Error:
               transManager:Rollback(xid).
               undo, throw e.
            end catch.

         end.

         catch e1 as Progress.Lang.Error:
            err = new LogisticsError(new Message(BaseMessageKey:FAILED_TO_CREATE_RECORD, LogisticsTranslatedString:mfg-DECLARANT)).
            err:RootCause = e1.
            undo, throw err.
         end catch.

      end. /* do on error undo, throw */

   end method.

   method public void Fetch(input domainCode as character,
                            input declarantAddressCode as character,
                            output dataset dsDeclarant):

      this-object:DeclarantBE:FetchObject(input domainCode,
                                          input declarantAddressCode,
                                          output dataset dsDeclarant by-reference).

   end method.

   method public void Initialize(output dataset  dsDeclarant):
  
      this-object:DeclarantBE:Initialize(output dataset dsDeclarant by-reference).

   end method.

   method public void Update(input dataset dsDeclarant):

      define variable valMsgs      as IList no-undo.
      define variable transManager as ITransactionManager no-undo.
      define variable err          as LogisticsError no-undo.
      define variable xid          as character no-undo.
      
      define buffer ttDeclarant for ttDeclarant.
      
      valMsgs = new List(Progress.Lang.Class:GetClass("com.qad.lang.IMessage")).

      do on error undo, throw:

         for each ttDeclarant on error undo, throw:

            ttDeclarant.DataOperation = DataOperations:UPDATE.

            /* Only initialize if record wasn't retrieved from database */
            if BaseUtils:IsNullOrEmpty(ttDeclarant.ConcurrencyHash) or
               Utility:IsReplacementRequired(buffer ttDeclarant:handle, 
                                             this-object:LeaveAsUnknownList, 
                                             this-object:DeclarantBE:ReadOnlyFields)
            then do: 

               dataset dsInitialDeclarant:empty-dataset().
   
               this-object:DeclarantBE:FetchObject(input ttDeclarant.DomainCode,
                                                   input ttDeclarant.DeclarantAddressCode,
                                                   output dataset dsInitialDeclarant by-reference).

               find ttInitialDeclarant where ttInitialDeclarant.DomainCode = ttDeclarant.DomainCode
                                        and  ttInitialDeclarant.DeclarantAddressCode = ttDeclarant.DeclarantAddressCode no-error.
   
               if available(ttInitialDeclarant) then do:
                  /* Replace the unknown values in the passed dataset with the initial dataset values,
                   * ensuring that the fields designated as read-only overwrite the values in the
                   * passed dataset */
                  Utility:CopyBufferReplaceUnknowns(buffer ttInitialDeclarant:handle,
                                                    buffer ttDeclarant:handle,
                                                    input  "",
                                                    input  if this-object:DeclarantBE:ReadOnlyFields <> ""
                                                               then ",CountryCode"
                                                               else this-object:DeclarantBE:ReadOnlyFields + ",CountryCode").
               end.  /* if available(ttInitialDeclarant) */
               else do:
                  undo, throw new LogisticsError(new Message(BaseMessageKey:RECORD_DOES_NOT_EXIST)).
               end.
         
            end. /* No Concurrency Hash */
            
         end. /* for each ttDeclarant */

         this-object:DeclarantBE:AssignDefaults(input-output dataset dsDeclarant by-reference).

         if not this-object:DeclarantBE:IsValid(input dataset dsDeclarant by-reference, output valMsgs) then
            undo, throw new LogisticsError(valMsgs).

         transManager = QraServices:GetTransactionManager().

         xid = transManager:StartTransaction().

         do on error undo, throw:

            this-object:DeclarantBE:Commit(dataset dsDeclarant by-reference).

            transManager:Commit(xid).

            catch e as Progress.Lang.Error:
               transManager:Rollback(xid).
               undo, throw e.
            end catch.

         end.

         catch e1 as Progress.Lang.Error:
            err = new LogisticsError(new Message(BaseMessageKey:FAILED_TO_UPDATE_RECORD, LogisticsTranslatedString:mfg-DECLARANT)).
            err:RootCause = e1.
            undo, throw err.
         end catch.

      end. /* do on error undo, throw */

   end method.

   method public void Delete(input dataset dsDeclarant):

      define variable valMsgs      as IList no-undo.
      define variable transManager as ITransactionManager no-undo.
      define variable err          as LogisticsError no-undo.
      define variable xid          as character no-undo.
      
      define buffer ttDeclarant for ttDeclarant.

      valMsgs = new List(Progress.Lang.Class:GetClass("com.qad.lang.IMessage")).

      do on error undo, throw:
         
         for each ttDeclarant on error undo, throw:
      
            dataset dsInitialDeclarant:empty-dataset().

            this-object:DeclarantBE:FetchObject(input ttDeclarant.DomainCode,
                                                input ttDeclarant.DeclarantAddressCode,
                                                output dataset dsInitialDeclarant by-reference).

            find ttInitialDeclarant where ttInitialDeclarant.DomainCode = ttDeclarant.DomainCode 
                                      and ttInitialDeclarant.DeclarantAddressCode = ttDeclarant.DeclarantAddressCode no-error.
   
            if available(ttInitialDeclarant) then do:
               buffer-copy ttInitialDeclarant except ConcurrencyHash to ttDeclarant.
               ttDeclarant.DataOperation = DataOperations:DELETE.
            end.
            else do:
               undo, throw new LogisticsError(new Message(BaseMessageKey:RECORD_DOES_NOT_EXIST)).
            end.
            
         end. /* for each ttDeclarant */
         
         if not this-object:DeclarantBE:IsValidForDelete(input dataset dsDeclarant by-reference, output valMsgs) then
            undo, throw new LogisticsError(valMsgs). 

         transManager = QraServices:GetTransactionManager().

         xid = transManager:StartTransaction().

         do on error undo, throw:

            this-object:DeclarantBE:Commit(dataset dsDeclarant by-reference).

            transManager:Commit(xid).

            catch e as Progress.Lang.Error:
               transManager:Rollback(xid).
               undo, throw e.
            end catch.

         end.

         catch e1 as Progress.Lang.Error:
            err = new LogisticsError(new Message(BaseMessageKey:FAILED_TO_DELETE, LogisticsTranslatedString:mfg-DECLARANT)).
            err:RootCause = e1.
            undo, throw err.
         end catch.

      end. /* do on error undo, throw */

   end method.

   method public void GetFieldDescription (input  domainCode   as character,
                                           input  fieldName    as character,
                                           input  fieldValue   as character,
                                           output description  as character):

      this-object:DeclarantBE:GetFieldDescription(input domainCode,
                                                  input fieldName, 
                                                  input fieldValue, 
                                                  output description).
      
      
   end method.
   
end class.
