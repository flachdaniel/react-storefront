import { Checkbox } from "@/checkout-storefront/components/Checkbox";
import {
  AddressFragment,
  useCheckoutBillingAddressUpdateMutation,
  useUserQuery,
} from "@/checkout-storefront/graphql";
import { useAlerts } from "@/checkout-storefront/hooks/useAlerts";
import { useCheckout } from "@/checkout-storefront/hooks/useCheckout";
import { useErrors } from "@/checkout-storefront/hooks/useErrors";
import { useFormattedMessages } from "@/checkout-storefront/hooks/useFormattedMessages";
import { extractMutationErrors, localeToLanguageCode } from "@/checkout-storefront/lib/utils";
import { useAuthState } from "@saleor/sdk";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { GuestAddressSection } from "../GuestAddressSection/GuestAddressSection";
import { Address, AddressFormData, UserAddressFormData } from "../../components/AddressForm/types";
import { UserAddressSection } from "../UserAddressSection/UserAddressSection";
import {
  isMatchingAddress,
  getAddressVlidationRulesVariables,
  getAddressInputData,
  getAddressFormDataFromAddress,
} from "@/checkout-storefront/lib/utils";
import { billingMessages } from "./messages";
import { useLocale } from "@/checkout-storefront/hooks/useLocale";
import { useCheckoutUpdateStateChange } from "@/checkout-storefront/state/updateStateStore";

export const BillingAddressSection = () => {
  const formatMessage = useFormattedMessages();
  const { locale } = useLocale();
  const { user: authUser } = useAuthState();
  const { checkout } = useCheckout();
  const { billingAddress, shippingAddress, id: checkoutId } = checkout;
  const { setCheckoutUpdateState } = useCheckoutUpdateStateChange("checkoutBillingUpdate");

  const hasBillingSameAsShipping = isMatchingAddress(shippingAddress, billingAddress);

  const [isBillingSameAsShipping, setIsBillingSameAsShipping] = useState<boolean>(
    checkout?.isShippingRequired ? !billingAddress || hasBillingSameAsShipping : false
  );

  const [{ data }] = useUserQuery({
    pause: !authUser?.id,
  });

  const user = data?.me;
  const addresses = user?.addresses;
  const errorProps = useErrors<UserAddressFormData>();
  const { setApiErrors } = errorProps;
  const [passDefaultFormDataAddress, setPassDefaultFormDataAddress] = useState<boolean>(
    !!billingAddress
  );

  const { showErrors } = useAlerts();

  const [, checkoutBillingAddressUpdate] = useCheckoutBillingAddressUpdateMutation();
  const isBillingSameAsShippingRef = useRef<boolean>(isBillingSameAsShipping);
  const shippingAddressRef = useRef<Address>(shippingAddress);

  const updateBillingAddress = useCallback(
    async ({ autoSave, ...addressInput }: AddressFormData) => {
      setCheckoutUpdateState("loading");
      const result = await checkoutBillingAddressUpdate({
        languageCode: localeToLanguageCode(locale),
        checkoutId,
        billingAddress: getAddressInputData(addressInput),
        validationRules: getAddressVlidationRulesVariables(autoSave),
      });

      const [hasErrors, errors] = extractMutationErrors(result);

      if (hasErrors) {
        setCheckoutUpdateState("error");
        showErrors(errors, "checkoutBillingUpdate");
        setApiErrors(errors);
        return;
      }

      setCheckoutUpdateState("success");
    },
    [
      checkoutBillingAddressUpdate,
      checkoutId,
      locale,
      setApiErrors,
      setCheckoutUpdateState,
      showErrors,
    ]
  );

  const setBillingSameAsShipping = useCallback(async () => {
    if (!hasBillingSameAsShipping && shippingAddress) {
      await updateBillingAddress({
        ...getAddressFormDataFromAddress(shippingAddress),
        autoSave: true,
      });
    }
  }, [hasBillingSameAsShipping, shippingAddress, updateBillingAddress]);

  useEffect(() => {
    const billingSetDifferentThanShipping =
      !isBillingSameAsShipping && isBillingSameAsShippingRef.current;

    if (billingSetDifferentThanShipping) {
      setPassDefaultFormDataAddress(false);
      isBillingSameAsShippingRef.current = isBillingSameAsShipping;
    }
  }, [isBillingSameAsShipping]);

  useEffect(() => {
    if (!isBillingSameAsShipping) {
      return;
    }

    const billingSetSameAsShipping = isBillingSameAsShipping && !isBillingSameAsShippingRef.current;

    const hasShippingAddressChanged =
      shippingAddress && shippingAddress !== shippingAddressRef.current;

    if (hasShippingAddressChanged || billingSetSameAsShipping) {
      void setBillingSameAsShipping();
      shippingAddressRef.current = shippingAddress;
      isBillingSameAsShippingRef.current = isBillingSameAsShipping;
      return;
    }
  }, [shippingAddress, isBillingSameAsShipping, setBillingSameAsShipping]);

  return (
    <div className="mt-2">
      {checkout.isShippingRequired && (
        <Checkbox
          classNames={{ container: "!mb-0" }}
          value="useShippingAsBilling"
          checked={isBillingSameAsShipping}
          onChange={setIsBillingSameAsShipping}
          label={formatMessage(billingMessages.useShippingAsBilling)}
          data-testid={"useShippingAsBillingCheckbox"}
        />
      )}
      {!isBillingSameAsShipping && (
        <div className="mt-4" data-testid="billingAddressSection">
          {authUser ? (
            <UserAddressSection
              {...errorProps}
              title={formatMessage(billingMessages.billingAddress)}
              type="BILLING"
              onAddressSelect={(address) => {
                void updateBillingAddress(address);
              }}
              addresses={addresses as AddressFragment[]}
              defaultAddress={user?.defaultBillingAddress}
            />
          ) : (
            <GuestAddressSection
              {...errorProps}
              type="BILLING"
              checkAddressAvailability={false}
              defaultAddress={passDefaultFormDataAddress ? checkout?.billingAddress : undefined}
              title={formatMessage(billingMessages.billingAddress)}
              onSubmit={(address) => {
                void updateBillingAddress(address);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
