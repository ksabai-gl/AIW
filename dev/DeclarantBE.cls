/*
 * com.qad.logistics.intrastat.DeclarantBE - Business entity class for Declarant
 *
 * Copyright 1986 QAD Inc. All rights reserved.
 *
 * $Id: DeclarantBE.cls 659972 2025-12-12 10:05:34Z jpm $
 */

using com.qad.base.BaseConstants.
using com.qad.base.BaseMessageKey.
using com.qad.base.BaseServices.
using com.qad.base.BaseUtils.
using com.qad.base.address.ICountry.
using com.qad.base.address.IMfgAddressDataObject.
using com.qad.base.item.ISite.

using com.qad.lang.IList.
using com.qad.lang.List.
using com.qad.lang.Message.

using com.qad.logistics.AppCache.
using com.qad.logistics.LogisticsConstants.
using com.qad.logistics.LogisticsDescriptions.
using com.qad.logistics.LogisticsMessageKey.
using com.qad.logistics.LogisticsTranslatedString.
using com.qad.logistics.LogisticsUtilities.
using com.qad.logistics.intrastat.DeclarantDA.

using com.qad.qra.QraServices.
using com.qad.qra.base.DataOperations.
using com.qad.qra.transaction.DAOFactory.

routine-level on error undo, throw.

class com.qad.logistics.intrastat.DeclarantBE:

   {com/qad/logistics/intrastat/dsDeclarant.i}
   {com/qad/qra/base/dsKeyField.i}

   define protected variable declarantDA as DeclarantDA no-undo.
   define private property BusinessEntityURI as character initial "urn:be:com.qad.logistics.intrastat.IDeclarant" no-undo get.

   define public property ReadOnlyFields as character initial "" no-undo
      get.
      private set.

   define public property CountryService as ICountry no-undo
      get:
         if not valid-object(CountryService) then
            this-object:CountryService = BaseServices:GetCountry().
         return CountryService.
      end get.
      set.

   define public property SiteService as ISite no-undo
      get:
         if not valid-object(SiteService) then
            this-object:SiteService = BaseServices:GetSite().
         return SiteService.
      end get.
      set.

   constructor public DeclarantBE():
      super().
      declarantDA = cast(DAOFactory:GetDataAccess(Progress.Lang.Class:GetClass("com.qad.logistics.intrastat.DeclarantDA")),DeclarantDA).
   end constructor.

   method public void Initialize(output dataset dsDeclarant):

      define variable domainCode as character no-undo.

      domainCode = BaseUtils:GetSessionDomain().

      dataset dsDeclarant:empty-dataset().

      create ttDeclarant.
      LogisticsUtilities:SetDefaults(buffer ttDeclarant:handle).

      assign
         ttDeclarant.DomainCode = domainCode
         ttDeclarant.VATRegistrationType = LogisticsConstants:DECLARANT_VAT_BILL-TO.

      QraServices:GetEntityFieldDefaultValueService():ApplyDefaults(input BusinessEntityURI, input-output dataset dsDeclarant by-reference).

   end method.

   method public void FetchObject(input domainCode as character,
                                  input declarantAddressCode as character,
                                  output dataset dsDeclarant):

      if valid-object(declarantDA) then
         declarantDA:FillDataSet(input domainCode,
                                 input declarantAddressCode,
                                 output dataset dsDeclarant by-reference).

      /*Get the descriptions */
      for each ttDeclarant on error undo, throw:

         this-object:GetFieldDescription(input domainCode,
                                         input "DeclarantAddressCode",
                                         input ttDeclarant.DeclarantAddressCode,
                                         output ttDeclarant.DeclarantAddressCodeDescription).

         this-object:GetFieldDescription(input domainCode,
                                         input "AgentCode",
                                         input ttDeclarant.AgentCode,
                                         output ttDeclarant.AgentCodeDescription).

         this-object:GetFieldDescription(input domainCode,
                                         input "CurrencyCode",
                                         input ttDeclarant.CurrencyCode,
                                         output ttDeclarant.CurrencyCodeDescription).

         this-object:GetFieldDescription(input domainCode,
                                         input "CountryCode",
                                         input ttDeclarant.CountryCode,
                                         output ttDeclarant.CountryCodeDescription).

         this-object:GetFieldDescription(input domainCode,
                                         input "DeclarationRegion",
                                         input ttDeclarant.DeclarationRegion,
                                         output ttDeclarant.DeclarationRegionDescription).

      end. /* for each ttDeclarant */

   end method.

   method public void Commit(input dataset dsDeclarant):

      declarantDA:Commit(dataset dsDeclarant by-reference).

   end method.

   method public logical IsValid(input dataset dsDeclarant,
                                 output valMsgs as IList):

      define variable mfgAddressDO as IMfgAddressDataObject    no-undo.
      define variable msg          as Message                  no-undo.
      define variable valMsgsTemp  as IList                    no-undo.
      
      define variable datasetHandle    as handle               no-undo.
      define variable bufferHandle     as handle               no-undo.
      define variable hQuery           as handle               no-undo.

      valMsgs = new List(Progress.Lang.Class:GetClass("com.qad.lang.IMessage")).

      /* Validate all validation rules that are defined in the entity metadata */
      QraServices:GetEntityMetadataService():IsValid(input "qad.logistics",
                                                     input "Declarants",
                                                     input (dataset dsDeclarant:handle),
                                                     output valMsgs).

      if not valMsgs:IsEmpty() then
         return valMsgs:IsEmpty().

      for each ttDeclarant on error undo, throw:

         if ttDeclarant.DataOperation = DataOperations:CREATE and
            declarantDA:Exists(input ttDeclarant.DomainCode,
                               input ttDeclarant.DeclarantAddressCode)
         then do:
             msg = new Message(LogisticsMessageKey:RECORD_ALREADY_EXIST, ttDeclarant.DomainCode, ttDeclarant.DeclarantAddressCode).
             msg:SetContext(buffer ttDeclarant:buffer-field("DeclarantAddressCode")).
             valMsgs:Add(msg).
             next.
         end.

         if not AppCache:IsValidActiveDomain(input ttDeclarant.DomainCode,
                                             output valMsgsTemp)
         then do:
            valMsgs:AddAll(valMsgsTemp).
            next.
         end.

         /* DeclarantAddressCode - must be valid */
         mfgAddressDO = AppCache:GetMfgAddressByAddressTypeDataObject(input ttDeclarant.DomainCode,
                                                                      input ttDeclarant.DeclarantAddressCode,
                                                                      input BaseConstants:MFG_ADDRTYPE_COMPANY).
         if not mfgAddressDO:Available then do:
            msg = new Message(LogisticsMessageKey:INVALID_COMPANY_ADDRESS).
            msg:SetContext(buffer ttDeclarant:buffer-field("DeclarantAddressCode")).
            valMsgs:Add(msg).
         end.

         /* Country code must be active */
         if not AppCache:IsActiveCountry(input ttDeclarant.CountryCode)
         then do:
            msg = new Message(LogisticsMessageKey:INVALID_COUNTRY).
            msg:SetContext(buffer ttDeclarant:buffer-field("CountryCode")).
            valMsgs:Add(msg).
         end.

         /* It must be a EC country */
         else
         if not this-object:CountryService:IsECCountry(input ttDeclarant.CountryCode)
         then do:
            msg = new Message(LogisticsMessageKey:COMPANY_COUNTRY_IS_NOT_EC_COUNTRY).
            msg:SetContext(buffer ttDeclarant:buffer-field("CountryCode")).
            valMsgs:Add(msg).
         end.

         /* Validate AgentCode */
         if BaseUtils:HasValue(ttDeclarant.AgentCode) then do:
            mfgAddressDO = AppCache:GetMfgAddressDataObject(input ttDeclarant.DomainCode,
                                                            input ttDeclarant.AgentCode).

            if not mfgAddressDO:Available then do:
               msg = new Message(LogisticsMessageKey:ADDRESS_DOES_NOT_EXIST).
               msg:SetContext(buffer ttDeclarant:buffer-field("AgentCode")).
               valMsgs:Add(msg).
            end.
         end.

         /* Validate CurrencyCode */
         if BaseUtils:HasValue(ttDeclarant.CurrencyCode) then do:
            if not AppCache:IsValidActiveCurrency (input ttDeclarant.CurrencyCode)
            then do:
               msg = new Message(BaseMessageKey:INVALID_CURRENCY, ttDeclarant.CurrencyCode).
               msg:SetContext(buffer ttDeclarant:buffer-field("CurrencyCode")).
               valMsgs:Add(msg).
            end.
         end.

         /* Validate DeclarationRegion */
         if not AppCache:IsValidGeneralizedCode(input ttDeclarant.DomainCode,
                                                input "ieh_region",
                                                input ttDeclarant.DeclarationRegion)
         then do:
            msg = new Message(BaseMessageKey:VALUE_MUST_IN_GENERALIZED_CODES, LogisticsTranslatedString:mfg-DECLARATION_REGION).
            msg:SetContext(buffer ttDeclarant:buffer-field("DeclarationRegion")).
            valMsgs:Add(msg).
         end.

         if ttDeclarant.DataOperation = DataOperations:UPDATE then do:

            dataset dsKeyField:empty-dataset.

            create ttKeyField.
            assign
               ttKeyField.KeyFieldName = "DomainCode"
               ttKeyField.KeyFieldValue = ttDeclarant.DomainCode.

            create ttKeyField.
            assign
               ttKeyField.KeyFieldName = "Declarant"
               ttKeyField.KeyFieldValue = ttDeclarant.DeclarantAddressCode.

            this-object:SiteService:FetchList(input dataset dsKeyField by-reference,
                                              input false,     /* includeConcurrencyHash */
                                              output dataset-handle datasetHandle).

            bufferHandle = datasetHandle:get-buffer-handle("ttSite").
            
            if valid-handle(bufferHandle) then do:

               bufferHandle:find-first() no-error.

               if not bufferHandle:available then
                  QraServices:GetSupplementaryMessageLogger():Warn(new Message(LogisticsMessageKey:DECLARANT_INDICATED_IN_SITE):String).
               else do on error undo, throw:

                  create query hQuery.
                  hQuery:set-buffers(bufferHandle).
                  hQuery:query-prepare("for each ttSite").
                  hQuery:query-open().
                  hQuery:get-first().

                  do while not hQuery:query-off-end on error undo, throw:

                     mfgAddressDO = AppCache:GetMfgAddressDataObject(input bufferHandle::DomainCode,
                                                                     input bufferHandle::SiteCode).

                     if not mfgAddressDO:Available or
                        (mfgAddressDO:Available and mfgAddressDO:CountryCode <> ttDeclarant.CountryCode)
                     then do:
                        QraServices:GetSupplementaryMessageLogger():Warn(new Message(LogisticsMessageKey:COUNTRY_CODE_IS_DIFFERENT_FROM_COMPANY_COUNTRY):String).
                        leave.
                     end.

                     hQuery:get-next().
                  end.

                  finally:
                     hQuery:query-close().
                     delete object hQuery no-error.
                  end finally.

               end. /* if not bufferHandle:available ... else */
               
            end. /* if valid-handle(bufferHandle */

         end. /* if ttDeclarant.DataOperation = DataOperations:UPDATE */

      end. /* for each ttDeclarant */

      return valMsgs:IsEmpty().

   end method.

   method public logical IsValidForDelete(input dataset dsDeclarant,
                                          output valMsgs as IList):

      valMsgs = new List(Progress.Lang.Class:GetClass("com.qad.lang.IMessage")).

      /* No validations required */

      return valMsgs:IsEmpty().

   end method.

   method public void GetFieldDescription (input domainCode   as character,
                                           input  fieldName   as character,
                                           input  fieldValue  as character,
                                           output description as character):

      if BaseUtils:IsNullOrEmpty(domainCode) then
         domainCode = BaseUtils:GetSessionDomain().

      if BaseUtils:IsNullOrEmpty(fieldName) then
         return.

      case fieldName:

         when "CurrencyCode" then do:
            LogisticsDescriptions:GetCurrencyDescription(input fieldValue,
                                                         output description).
         end.

         when "CountryCode" then do:
            LogisticsDescriptions:GetCountryDescription(input fieldValue,
                                                        output description).
         end.

         when "DeclarationRegion" then do:
            LogisticsDescriptions:GetGeneralizedCodeComments(input domainCode,
                                                             input "ieh_region",
                                                             input fieldValue,
                                                             output description).
         end.

         when "AgentCode" then do:
            LogisticsDescriptions:GetMfgAddressName(input domainCode,
                                                    input fieldValue,
                                                    input ?, /*addressType*/
                                                    output description).
         end.

         when "DeclarantAddressCode" then do:
            LogisticsDescriptions:GetMfgAddressName(input domainCode,
                                                    input fieldValue,
                                                    input BaseConstants:MFG_ADDRTYPE_COMPANY,
                                                    output description).
         end.

      end case.

   end method.

   method public void AssignDefaults(input-output dataset dsDeclarant):

      for each ttDeclarant on error undo, throw:

         if BaseUtils:HasValue(ttDeclarant.VATRegistrationType) then
            ttDeclarant.IsVATRegistrationNumber = if (ttDeclarant.VATRegistrationType = LogisticsConstants:DECLARANT_VAT_SHIP-TO) then
                                                     true
                                                  else
                                                     false.

      end.

   end method.

end class.
