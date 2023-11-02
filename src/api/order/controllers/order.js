// @ts-nocheck
("use strict");

const stripe = require("stripe")(process.env.STRIPE_KEY);
const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    const { products } = ctx.request.body;
    try {
      const lineItems = await Promise.all(
        products.map(async (product) => {
          const item = await strapi
            .service("api::product.product")
            .findOne(product.id);

          const size = item.sizes.find((el) => el === product.size);
          const color = item.colors.find(
            (el) => el.name === product.color
          ).name;

          return {
            price_data: {
              currency: "pln",
              product_data: {
                name: `${item.title} ${item.schoolName} ${color} ${size}`,
                metadata: {
                  title: item.title,
                  schoolName: item.schoolName,
                  size: size,
                  color: color,
                },
              },
              unit_amount: Math.round(item.discountPrice * 100),
            },
            quantity: product.quantity,
          };
        })
      );

      const session = await stripe.checkout.sessions.create({
        shipping_address_collection: { allowed_countries: [] },
        payment_method_types: ["card", "blik", "p24"],
        mode: "payment",
        success_url: process.env.CLIENT_URL + "?success=true",
        cancel_url: process.env.CLIENT_URL + "?success=false",
        line_items: lineItems,
        custom_fields: [
          {
            key: "fullName",
            label: {
              type: "custom",
              custom: "Imię i nazwisko",
            },
            type: "text",
          },
          {
            key: "phoneNumber",
            label: {
              type: "custom",
              custom: "Numer telefonu",
            },
            type: "numeric",
          },
        ],
      });

      await strapi
        .service("api::order.order")
        .create({ data: { products, stripeId: session.id } });

      return { stripeSession: session };
    } catch (error) {
      ctx.response.status = 500;
      return { error };
    }
  },
}));
